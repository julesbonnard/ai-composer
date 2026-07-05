// Extension Tiptap « linter éditorial » — généralise Limit.ts : au lieu de
// simples limites de longueur, elle exécute le cœur stylecheck (déterministe)
// et décore les passages qui enfreignent les règles éditoriales AFP.
//
// Deux sorties :
//   - décorations inline (squiggle par gravité + tooltip natif) via le plugin PM ;
//   - liste de diagnostics positionnés, exposée pour le panneau « Problèmes »
//     (lue par le composant Vue à chaque transaction).

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'
import { lintDoc, type PositionedDiagnostic } from './editorial/proseMirror'
import type { DispatchMeta } from 'stylecheck'

export interface EditorialLinterOptions {
  /** Métadonnées courantes de la dépêche (type/langue/dateline). Réactif via getter. */
  getMeta: () => DispatchMeta
}

export interface EditorialLinterStorage {
  diagnostics: PositionedDiagnostic[]
}

export const editorialLinterKey = new PluginKey('editorialLinter')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    editorialLinter: {
      /** Force un recalcul des diagnostics (ex. après changement de métadonnées). */
      refreshLint: () => ReturnType
    }
  }
}

export default Extension.create<EditorialLinterOptions, EditorialLinterStorage>({
  name: 'editorialLinter',

  addOptions() {
    return {
      getMeta: () => ({ type: 'pg', lang: 'fr' }),
    }
  },

  addStorage() {
    return { diagnostics: [] }
  },

  addCommands() {
    return {
      // Transaction no-op : déclenche la ré-exécution du plugin de décorations.
      refreshLint:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(editorialLinterKey, { refresh: true }))
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    const extension = this
    return [
      new Plugin({
        key: editorialLinterKey,
        props: {
          decorations: ({ doc }) => {
            const { decorations, diagnostics } = lintDoc(doc, extension.options.getMeta())
            // On mémorise la liste pour le panneau (lue après chaque transaction).
            extension.storage.diagnostics = diagnostics
            return DecorationSet.create(doc, decorations)
          },
        },
      }),
    ]
  },
})
