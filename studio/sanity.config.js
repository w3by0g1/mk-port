import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'

// The profile is a single document with a fixed id, opened straight from
// the sidebar; the directory reads it by that id.
const PROFILE = 'profile'

export default defineConfig({
  name: 'default',
  title: 'mkportfolio',

  projectId: 'sgenxzel',
  dataset: 'production',

  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Content')
          .items([
            S.listItem()
              .title('Profile')
              .id(PROFILE)
              .child(S.document().schemaType('profile').documentId(PROFILE)),
            S.divider(),
            S.documentTypeListItem('project').title('Projects'),
          ]),
    }),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
    // No making a second profile from the new document menu.
    templates: (templates) => templates.filter(({schemaType}) => schemaType !== 'profile'),
  },

  document: {
    // Nor copying or deleting the one there is.
    actions: (actions, {schemaType}) =>
      schemaType === 'profile'
        ? actions.filter(({action}) => action !== 'duplicate' && action !== 'delete')
        : actions,
  },
})
