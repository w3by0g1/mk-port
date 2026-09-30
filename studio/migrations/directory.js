// Moves the dataset over to the directory's shape, and fills it with what
// the directory in new-port was written with.
//
//   npx sanity exec migrations/directory.js --with-user-token -- --dry-run
//   npx sanity exec migrations/directory.js --with-user-token
//
// The first says what it would do and does nothing; the second does it, in
// one transaction, so it all goes in or none of it does.
//
// What it does:
// - The four projects already here keep their documents, and with them
//   their showcase media. Everything else on them from before is taken off
//   (the old name, display name, URL, image, colours, type, date and
//   description), and the directory's fields are put on.
// - Life is Beautiful and LYCHEE Electronics, which were not here, are made.
// - The profile, which was not here, is made with the about, links,
//   education, experience, mixes and releases.
//
// It can be run again safely: nothing is made twice, the showcase media are
// never touched, and the directory's fields are set to the same values.
// Anything changed in the studio since the first run would be set back,
// though, so it is meant to be run once.

import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2024-01-01'})
const dryRun = process.argv.includes('--dry-run')

// The documents already here, by the directory's name for each.
const EXISTING = {
  Martingales: 'f5528e03-0fe8-4f9f-9e3a-4626899cf301',
  RADIOproject: '06cd91b3-8c93-4734-924c-cb6522cf2386',
  'Translate Yourself': '200d7a46-e8d6-4e6a-960f-e2b6e1aa7a8f',
  ATM: '02c98fee-6edd-4738-9103-4b2c0b66dc0e',
}

// The fields a project had before that it no longer has.
const RETIRED = [
  'displayName',
  'url',
  'image',
  'color',
  'deepColor',
  'glassColor',
  'type',
  'date',
  'description',
]

const SEED = {
  "projects": [
    {
      "name": "Life is Beautiful",
      "kind": "Gesamtkunstwerk/Record Label",
      "services": [
        "Interactivity Design",
        "Web Design + Development"
      ],
      "link": {
        "label": "lifeisbeautifulrecords.co.uk",
        "href": "https://lifeisbeautifulrecords.co.uk"
      },
      "height": 181
    },
    {
      "name": "Martingales",
      "kind": "Investment Firm",
      "services": [
        "Website Design + Development"
      ],
      "status": "Archived"
    },
    {
      "name": "LYCHEE Electronics",
      "kind": "Human-Centric Electronics Company",
      "services": [
        "App Design + Development",
        "Web Design + Development"
      ],
      "status": "Confidential",
      "height": 88,
      "striped": true
    },
    {
      "name": "RADIOproject",
      "kind": "Community Radio + Editorial Platform",
      "services": [
        "Full Stack",
        "Website Design + Development",
        "Brand Identity"
      ],
      "link": {
        "label": "radioproject.live",
        "href": "https://radioproject.live"
      },
      "height": 88
    },
    {
      "name": "Translate Yourself",
      "client": "for Silv-o",
      "kind": "Online Sketchbook Forum",
      "services": [
        "Full Stack",
        "Website Design + Development"
      ],
      "link": {
        "label": "translateyourself.net",
        "href": "https://translateyourself.net"
      }
    },
    {
      "name": "ATM",
      "client": "for Talia Panayi",
      "kind": "Data Maison + Fashion Editorial",
      "services": [
        "Full Stack",
        "Website Development"
      ],
      "link": {
        "label": "atm.datamaison.ai",
        "href": "https://atm.datamaison.ai"
      }
    }
  ],
  "about": [
    "Elisha Olunaike is a **web and app designer developer** interested in challenging web experiences + creating unique interactions for the web. In the mean time, he is produces and DJ's under the aliases **\"PALMREADER\" + \"MK\"**, respectively.",
    "He holds a **BSc in Computer Science** from the **University of Portsmouth** + an **MSc in Digital + Technology Solutions** from **Manchester Metropolitan University.**",
    "Previously at **Bupa,** then **LYCHEE Electronics.** Currently, freelancing + innovating radio experience at **RADIOproject.**"
  ],
  "links": [
    {
      "label": "Instagram",
      "href": "https://instagram.com/cattleherder"
    },
    {
      "label": "Email",
      "href": "mailto:w3by0g1@proton.me"
    },
    {
      "label": "RADIOproject.live",
      "href": "https://radioproject.live"
    }
  ],
  "education": [
    {
      "name": "University of Portsmouth",
      "lines": [
        "BSc in Computer Science"
      ],
      "years": "2019-2022"
    },
    {
      "name": "Manchester Metropolitan University",
      "lines": [
        "MsC in Digital + Technology Solutions",
        "Level 7 Degree Apprenticeship in Digital + Technology Solutions"
      ],
      "years": "2023-2025"
    }
  ],
  "experience": [
    {
      "name": "LYCHEE Electronics",
      "lines": [
        "App Designer Developer + Web Designer Developer"
      ],
      "years": "2025-2026"
    },
    {
      "name": "BUPA",
      "lines": [
        "Power Platform Developer + Automation Tester"
      ],
      "years": "2023-2025"
    }
  ],
  "mixes": [
    {
      "tag": "MIX",
      "title": "KINDRED Radio",
      "with": "with Temz",
      "date": "24th of August 2026"
    },
    {
      "tag": "MIX",
      "title": "KINDRED Radio",
      "date": "5th of May 2026"
    },
    {
      "tag": "MIX",
      "title": "Gauchoworld Platinum Sounds 30",
      "date": "16th of April 2026"
    },
    {
      "tag": "MIX",
      "title": "BRISKWALK radio",
      "with": "with Moonkay",
      "date": "3rd of February 2026"
    },
    {
      "tag": "GIG",
      "title": "Exxtralife 1 Year Anniversary",
      "with": "with Temz as 9JA",
      "date": "14th of March 2026"
    }
  ],
  "releases": [
    {
      "tag": "7I-ABM",
      "title": "MKDRIVER",
      "with": "featuring kwes e and BEASTIE",
      "date": "2nd of March 2023"
    },
    {
      "tag": "2I-CPL",
      "title": "heart-burst-demo-compilation-victory-bomb",
      "date": "5th of May 2025"
    },
    {
      "tag": "SGL",
      "title": "world-shaker (durutti column)",
      "date": "5th of May 2026"
    },
    {
      "tag": "SGL",
      "title": "Congratulations!",
      "date": "5th of May 2026"
    }
  ]
}

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Items in an array of objects each need a key of their own.
const keyed = (items, prefix) => items.map((item, i) => ({_key: `${prefix}${i}`, ...item}))

// A project's fields as the directory has them. Absent ones are left out
// rather than set empty.
const projectFields = (project, order) => {
  const fields = {
    name: project.name,
    kind: project.kind,
    services: project.services,
    striped: Boolean(project.striped),
    order,
  }
  if (project.client) fields.client = project.client
  if (project.status) fields.status = project.status
  if (project.height) fields.height = project.height
  if (project.link) fields.link = {label: project.link.label, url: project.link.href}
  return fields
}

// A paragraph with **bold** runs, as a block of text.
const block = (text, i) => ({
  _type: 'block',
  _key: `about${i}`,
  style: 'normal',
  markDefs: [],
  children: text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, j) => {
      const bold = part.startsWith('**') && part.endsWith('**')
      return {
        _type: 'span',
        _key: `about${i}s${j}`,
        text: bold ? part.slice(2, -2) : part,
        marks: bold ? ['strong'] : [],
      }
    }),
})

const listing = ({tag, title, with: others, date}) => {
  const item = {_type: 'listing', tag, title, date}
  if (others) item.with = others
  return item
}

const history = ({name, lines, years}) => ({_type: 'historyEntry', name, lines, years})

async function main() {
  // A document being edited in the studio has a draft beside it, which the
  // studio shows in its place, so a draft is changed the same way.
  const ids = Object.values(EXISTING)
  const drafts = await client.fetch('*[_id in $ids]._id', {
    ids: ids.map((id) => `drafts.${id}`),
  })
  const found = await client.fetch('*[_id in $ids]._id', {ids})
  const missing = ids.filter((id) => !found.includes(id))
  if (missing.length) throw new Error(`Not found, so not going ahead: ${missing.join(', ')}`)

  const tx = client.transaction()
  const said = []

  SEED.projects.forEach((project, i) => {
    const fields = projectFields(project, i + 1)
    const id = EXISTING[project.name]
    if (id) {
      for (const target of [id, ...drafts.filter((d) => d === `drafts.${id}`)]) {
        tx.patch(target, (p) => p.set(fields).unset(RETIRED))
        said.push(`update ${target} -> ${project.name}`)
      }
    } else {
      const made = `project-${slug(project.name)}`
      tx.createIfNotExists({_id: made, _type: 'project', ...fields})
      tx.patch(made, (p) => p.set(fields))
      said.push(`make   ${made} -> ${project.name}`)
    }
  })

  const profile = {
    name: 'Elisha Olunaike',
    about: SEED.about.map(block),
    links: keyed(
      SEED.links.map(({label, href}) => ({_type: 'linkOut', label, url: href})),
      'link',
    ),
    education: keyed(SEED.education.map(history), 'education'),
    experience: keyed(SEED.experience.map(history), 'experience'),
    mixes: keyed(SEED.mixes.map(listing), 'mix'),
    releases: keyed(SEED.releases.map(listing), 'release'),
  }
  tx.createIfNotExists({_id: 'profile', _type: 'profile'})
  tx.patch('profile', (p) => p.set(profile))
  said.push('make   profile')

  console.log(said.join('\n'))
  if (dryRun) {
    console.log('\nDry run: nothing was changed. The transaction would be:\n')
    console.log(JSON.stringify(tx.serialize(), null, 2))
    return
  }
  const result = await tx.commit()
  console.log(`\nDone: ${result.results.length} changes in transaction ${result.transactionId}.`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
