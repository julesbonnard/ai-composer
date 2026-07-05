// Extension Tiptap « linter éditorial » — généralise Limit.ts, à DEUX vitesses :
//   - DÉTERMINISTE (sync, à chaque frappe) : décorations calculées depuis le doc.
//   - SÉMANTIQUE (async, À LA DEMANDE) : diagnostics du juge IA posés via commande,
//     stockés dans l'état du plugin, et EFFACÉS dès que le doc change (un résultat
//     IA est un instantané du texte analysé ; on le rejoue plutôt que de le laisser
//     dériver). Le déterministe, lui, reste toujours à jour.

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { lintDoc, type PositionedDiagnostic } from './editorial/proseMirror'
import type { DispatchMeta } from 'stylecheck'

export interface EditorialLinterOptions {
  /** Métadonnées courantes de la dépêche (type/langue/dateline). Réactif via getter. */
  getMeta: () => DispatchMeta
}

export interface EditorialLinterStorage {
  diagnostics: PositionedDiagnostic[]
}

export const editorialLinterKey = new PluginKey<DecorationSet>('editorialLinter')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    editorialLinter: {
      /** Force un recalcul des diagnostics déterministes (ex. changement de métadonnées). */
      refreshLint: () => ReturnType
      /** Pose les diagnostics sémantiques (juge IA) comme décorations. */
      setSemanticDiagnostics: (diagnostics: PositionedDiagnostic[]) => ReturnType
      /** Efface les décorations sémantiques. */
      clearSemanticDiagnostics: () => ReturnType
    }
  }
}

/** Construit les décorations inline (squiggle) des diagnostics sémantiques ancrables. */
function semanticDecorations(diagnostics: PositionedDiagnostic[]): Decoration[] {
  return diagnostics
    .filter((d) => !d.blockLevel)
    .map((d) => {
      const tip = d.suggestion ? `${d.message}\n💡 ${d.suggestion}` : d.message
      return Decoration.inline(d.from, d.to, {
        class: `stylecheck-diag stylecheck-${d.severity} stylecheck-semantic`,
        'data-rule': d.ruleId,
        title: tip
      })
    })
}

export default Extension.create<EditorialLinterOptions, EditorialLinterStorage>({
  name: 'editorialLinter',

  addOptions() {
    return { getMeta: () => ({ type: 'pg', lang: 'fr' }) }
  },

  addStorage() {
    return { diagnostics: [] }
  },

  addCommands() {
    return {
      refreshLint:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(editorialLinterKey, { refresh: true }))
          return true
        },
      setSemanticDiagnostics:
        (diagnostics) =>
        ({ tr, dispatch }) => {
          if (dispatch)
            dispatch(tr.setMeta(editorialLinterKey, { setSemantic: semanticDecorations(diagnostics) }))
          return true
        },
      clearSemanticDiagnostics:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(editorialLinterKey, { clearSemantic: true }))
          return true
        }
    }
  },

  addProseMirrorPlugins() {
    const extension = this
    return [
      new Plugin<DecorationSet>({
        key: editorialLinterKey,
        // État = décorations SÉMANTIQUES uniquement (le déterministe est recalculé dans props).
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(editorialLinterKey) as
              | { setSemantic?: Decoration[]; clearSemantic?: boolean }
              | undefined
            if (meta?.setSemantic) return DecorationSet.create(tr.doc, meta.setSemantic)
            if (meta?.clearSemantic) return DecorationSet.empty
            // Une édition invalide l'instantané IA → on efface (le déterministe prend le relais).
            if (tr.docChanged) return DecorationSet.empty
            return old
          }
        },
        props: {
          decorations(state) {
            // Déterministe : recalculé à chaque rendu depuis le doc courant.
            const { decorations, diagnostics } = lintDoc(state.doc, extension.options.getMeta())
            extension.storage.diagnostics = diagnostics
            // Sémantique : décorations posées à la demande, lues depuis l'état du plugin.
            const semantic = editorialLinterKey.getState(state)
            const all =
              semantic && semantic !== DecorationSet.empty
                ? [...decorations, ...semantic.find()]
                : decorations
            return DecorationSet.create(state.doc, all)
          }
        }
      })
    ]
  }
})
