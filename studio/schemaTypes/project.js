import {defineField, defineType} from 'sanity'

// A project, as it is shown on its tile in the directory: who it was for
// down the left half, what it was and what was done down the right. Its
// showcase media are the work itself, shown once the project is opened.
export default defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'The heading on its tile, e.g. "Life is Beautiful".',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'date',
      description:
        'When it was, under the name on its tile. Only the month and year are shown, e.g. "Mar 2026", so any day in the month will do.',
      options: {dateFormat: 'MMM YYYY'},
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      description:
        'Its address on the site, e.g. "life-is-beautiful" for /life-is-beautiful. Press Generate to make one from the name.',
      options: {source: 'name', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'client',
      title: 'Client',
      type: 'string',
      description: 'Who it was for, under the name, e.g. "for Silv-o". Optional.',
    }),
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      description: 'What the client is, at the top of the right half, e.g. "Online Sketchbook Forum".',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 5,
      description:
        'A few words about the work, in a panel under its name once it is opened. Leave a blank line between paragraphs.',
    }),
    defineField({
      name: 'services',
      title: 'Services',
      type: 'array',
      of: [{type: 'string'}],
      description: 'What was done, one to a line at the foot of the right half.',
    }),
    defineField({
      name: 'link',
      title: 'Link',
      type: 'object',
      description:
        'The site, at the foot of the left half. Leave it empty and the status shows there instead.',
      fields: [
        defineField({
          name: 'label',
          title: 'Label',
          type: 'string',
          description: 'As it reads on the tile, e.g. "radioproject.live".',
        }),
        defineField({name: 'url', title: 'URL', type: 'url'}),
      ],
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      description:
        'At the foot of the left half when there is no link, e.g. "Archived" or "Confidential".',
    }),
    defineField({
      name: 'selected',
      title: 'Select Works',
      type: 'boolean',
      description: 'One of the select works: its tile gets a star in the top right corner.',
      initialValue: false,
    }),
    defineField({
      name: 'darkBackground',
      title: 'Dark Background',
      type: 'boolean',
      description: 'When it is opened, the page behind it goes dark, for work that looks best on dark.',
      initialValue: false,
    }),
    defineField({
      name: 'striped',
      title: 'Striped',
      type: 'boolean',
      description: 'Stripe the tile over, for work that cannot be shown.',
      initialValue: false,
    }),
    defineField({
      name: 'showcaseMedia',
      title: 'Showcase Media',
      type: 'array',
      of: [
        {type: 'image', options: {hotspot: true}},
        {
          type: 'file',
          title: 'Video',
          options: {accept: 'video/*'},
        },
      ],
      description: 'Images and videos shown in the project carousel',
    }),
    defineField({
      name: 'order',
      title: 'Sort Order',
      type: 'number',
      description:
        'Where it comes down the directory, lower first. The last two sit side by side.',
    }),
  ],
  orderings: [
    {
      title: 'Sort Order',
      name: 'orderAsc',
      by: [{field: 'order', direction: 'asc'}],
    },
  ],
  preview: {
    select: {title: 'name', subtitle: 'kind'},
  },
})
