// Turns each project's description from plain text into blocks, so its
// words can be bolded in the studio, as the about can. Each run of text
// between blank lines becomes a paragraph of its own, as the page has
// always shown it. Drafts are turned as well as what is published.
//
//   npx sanity exec migrations/description-blocks.js --with-user-token -- --dry-run
//   npx sanity exec migrations/description-blocks.js --with-user-token
//
// The first says what it would do and does nothing; the second does it, in
// one transaction, so it all goes in or none of it does. It can be run
// again safely: a description already in blocks is left as it is.

import {getCliClient} from 'sanity/cli'
import {randomUUID} from 'node:crypto'

const client = getCliClient({apiVersion: '2024-01-01'})
const dryRun = process.argv.includes('--dry-run')

const key = () => randomUUID().replace(/-/g, '').slice(0, 12)

const blocksOf = (text) =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      _type: 'block',
      _key: key(),
      style: 'normal',
      markDefs: [],
      children: [{_type: 'span', _key: key(), text: paragraph, marks: []}],
    }))

async function run() {
  const projects = await client.fetch(
    `*[_type == "project" && defined(description)]{_id, name, description}`,
  )
  const plain = projects.filter(({description}) => typeof description === 'string')

  if (!plain.length) {
    console.log('Every description is in blocks already.')
  } else {
    const transaction = client.transaction()
    for (const {_id, name, description} of plain) {
      const blocks = blocksOf(description)
      console.log(`${name} (${_id}): ${blocks.length} paragraph(s)`)
      transaction.patch(_id, (patch) => patch.set({description: blocks}))
    }
    if (dryRun) {
      console.log(`\nDry run: ${plain.length} description(s) would be turned.`)
    } else {
      await transaction.commit()
      console.log(`\nTurned ${plain.length} description(s).`)
    }
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
