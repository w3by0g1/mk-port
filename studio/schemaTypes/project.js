import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'URL-style name (e.g. "translateyourself.net")',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'displayName',
      title: 'Display Name',
      type: 'string',
      description: 'Human-readable name shown in the UI',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
    }),
    defineField({
      name: 'image',
      title: 'Card Image',
      type: 'image',
      options: {hotspot: true},
      description: 'Main image shown on the project card',
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
      name: 'color',
      title: 'Color',
      type: 'string',
      description: 'Hex color for the project (e.g. "#c6fc50")',
      validation: (rule) => rule.regex(/^#[0-9a-fA-F]{6}$/, {name: 'hex color'}),
    }),
    defineField({
      name: 'type',
      title: 'Type Tags',
      type: 'array',
      of: [{type: 'string'}],
      options: {
        layout: 'tags',
      },
      description: 'e.g. "design", "development", "brand identity"',
    }),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'string',
      description: 'Display date (e.g. "JUL 2024")',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 4,
    }),
    defineField({
      name: 'order',
      title: 'Sort Order',
      type: 'number',
      description: 'Controls the display order (lower = first)',
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
    select: {
      title: 'displayName',
      subtitle: 'date',
      media: 'image',
    },
  },
})
