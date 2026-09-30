import {defineArrayMember, defineField, defineType} from 'sanity'

// A line of history: a place, what was done there, and when.
export const historyEntry = defineType({
  name: 'historyEntry',
  title: 'Entry',
  type: 'object',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'e.g. "University of Portsmouth".',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'lines',
      title: 'Lines',
      type: 'array',
      of: [{type: 'string'}],
      description: 'What was done there, one to a line.',
    }),
    defineField({
      name: 'years',
      title: 'Years',
      type: 'string',
      description: 'e.g. "2019-2022".',
    }),
  ],
  preview: {select: {title: 'name', subtitle: 'years'}},
})

// A mix, gig or release: one line along the foot of the directory.
export const listing = defineType({
  name: 'listing',
  title: 'Listing',
  type: 'object',
  fields: [
    defineField({
      name: 'tag',
      title: 'Tag',
      type: 'string',
      description: 'The faint label before the title, e.g. "MIX", "GIG" or "SGL".',
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'with',
      title: 'With',
      type: 'string',
      description: 'Who else was on it, after the title, e.g. "with Temz". Optional.',
    }),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'string',
      description: 'As it reads, e.g. "24th of August 2026".',
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
      description: 'Where it can be heard. Optional; without one it is plain text.',
    }),
  ],
  preview: {select: {title: 'title', subtitle: 'date'}},
})

// A quote for the float button, which shows one of them at random each
// time the page is opened.
export const quote = defineType({
  name: 'quote',
  title: 'Quote',
  type: 'object',
  fields: [
    defineField({
      name: 'text',
      title: 'Quote',
      type: 'text',
      rows: 2,
      description: 'Without quotation marks; the page puts them in.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'by',
      title: 'By',
      type: 'string',
      description: 'Who said it, shown under it. Optional.',
    }),
  ],
  preview: {select: {title: 'text', subtitle: 'by'}},
})

// A link out, in the links tile.
export const linkOut = defineType({
  name: 'linkOut',
  title: 'Link',
  type: 'object',
  fields: [
    defineField({name: 'label', title: 'Label', type: 'string'}),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
      validation: (rule) => rule.uri({scheme: ['http', 'https', 'mailto']}),
    }),
  ],
  preview: {select: {title: 'label', subtitle: 'url'}},
})

// Everything in the directory that is about the person rather than a
// project. There is only ever the one; the studio opens it directly.
export default defineType({
  name: 'profile',
  title: 'Profile',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'The heading on the about tile.',
    }),
    defineField({
      name: 'about',
      title: 'About',
      type: 'array',
      description: 'A paragraph to a block. Bold picks out the words that matter.',
      of: [
        defineArrayMember({
          type: 'block',
          styles: [{title: 'Normal', value: 'normal'}],
          lists: [],
          marks: {
            decorators: [{title: 'Bold', value: 'strong'}],
            annotations: [],
          },
        }),
      ],
    }),
    defineField({
      name: 'links',
      title: 'Links',
      type: 'array',
      of: [{type: 'linkOut'}],
    }),
    defineField({
      name: 'education',
      title: 'Education',
      type: 'array',
      of: [{type: 'historyEntry'}],
    }),
    defineField({
      name: 'experience',
      title: 'Experience',
      type: 'array',
      of: [{type: 'historyEntry'}],
    }),
    defineField({
      name: 'mixes',
      title: 'Mixes + Gigs',
      type: 'array',
      of: [{type: 'listing'}],
      description: 'Down the first column along the foot.',
    }),
    defineField({
      name: 'releases',
      title: 'Releases',
      type: 'array',
      of: [{type: 'listing'}],
      description: 'Down the second column along the foot.',
    }),
    defineField({
      name: 'quotes',
      title: 'Quotes',
      type: 'array',
      of: [{type: 'quote'}],
      description:
        'The float button shows one of these, picked at random each time the page is opened.',
    }),
  ],
  preview: {prepare: () => ({title: 'Profile'})},
})
