// Moves the dark background from each project onto its pieces: a project
// that was dark has every piece of its showcase made dark, so it looks just
// as it did, and the project's own switch is taken off, as it is now each
// piece that says. Drafts are moved as well as what is published.
//
//   npx sanity exec migrations/dark-per-piece.js --with-user-token -- --dry-run
//   npx sanity exec migrations/dark-per-piece.js --with-user-token
//
// The first says what it would do and does nothing; the second does it, in
// one transaction, so it all goes in or none of it does. It can be run
// again safely: a project with no switch of its own is left as it is, and
// a piece already set either way is not touched.

import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2024-01-01'})
const dryRun = process.argv.includes('--dry-run')

async function run() {
  const projects = await client.fetch(
    `*[_type == "project" && defined(darkBackground)]{
      _id, name, darkBackground, "pieces": showcaseMedia[]{_key, darkBackground}
    }`,
  )
  if (!projects.length) {
    console.log('No project has a dark background of its own left.')
    return
  }
  const transaction = client.transaction()
  for (const {_id, name, darkBackground, pieces} of projects) {
    const unset = (pieces ?? []).filter(
      (piece) => piece._key && piece.darkBackground == null,
    )
    const set = darkBackground
      ? Object.fromEntries(
          unset.map(({_key}) => [`showcaseMedia[_key=="${_key}"].darkBackground`, true]),
        )
      : {}
    console.log(
      `${name} (${_id}): ${darkBackground ? `dark, ${unset.length} piece(s) made dark` : 'not dark'}; its own switch taken off`,
    )
    transaction.patch(_id, (patch) =>
      (Object.keys(set).length ? patch.set(set) : patch).unset(['darkBackground']),
    )
  }
  if (dryRun) {
    console.log(`\nDry run: ${projects.length} project(s) would be moved.`)
  } else {
    await transaction.commit()
    console.log(`\nMoved ${projects.length} project(s).`)
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
