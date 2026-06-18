import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// Surlignage transitoire (décoration, non persistée) dans l'éditeur de source :
// met en évidence le segment ayant servi à générer un passage IA. Piloté par méta
// de transaction (`set` { from, to } / `clear`).
export const sourceHighlightKey = new PluginKey('sourceHighlight')

const SourceHighlight = Extension.create({
  name: 'sourceHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: sourceHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const meta = tr.getMeta(sourceHighlightKey)
            if (meta?.type === 'clear') return DecorationSet.empty
            if (meta?.type === 'set') {
              return DecorationSet.create(tr.doc, [
                Decoration.inline(meta.from, meta.to, { class: 'source-hit' })
              ])
            }
            return set.map(tr.mapping, tr.doc)
          }
        },
        props: {
          decorations(state) {
            return this.getState(state)
          }
        }
      })
    ]
  }
})

export default SourceHighlight
