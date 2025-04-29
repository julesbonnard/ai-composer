import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export default Extension.create({
  name: 'limit',
  addOptions() {
    return {
      limits: {}
    }
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('Limit'),
        props: {
          decorations: ({ doc }) => {
            const decorations: Decoration[] = []

            doc.descendants((node, pos) => {
              const nodeType = node.type.name
              if (this.options.limits[nodeType]) {
                if (this.options.limits[nodeType].charCount) {
                  const charCount = node.textContent.length
                  if (charCount > this.options.limits[nodeType].charCount) {
                    decorations.push(
                      Decoration.inline(
                        pos + this.options.limits[nodeType].charCount,
                        pos + node.nodeSize,
                        {
                          'data-limit': 'char',
                          class: 'unvalid'
                        }
                      )
                    )
                  }
                } else if (this.options.limits[nodeType].wordCount) {
                  const counter = node.textContent.split('').reduce(
                    (acc, cur) => {
                      if (cur == ' ') {
                        acc.words++
                      }
                      if (acc.words < this.options.limits[nodeType].wordCount) {
                        acc.chars++
                      }
                      return acc
                    },
                    {
                      words: 0,
                      chars: 2
                    }
                  )
                  if (counter.words >= this.options.limits[nodeType].wordCount) {
                    decorations.push(
                      Decoration.inline(pos + counter.chars, pos + node.nodeSize, {
                        'data-limit': 'word',
                        class: 'unvalid'
                      })
                    )
                  }
                }
                return true
              }
            })
            return DecorationSet.create(doc, decorations)
          }
        }
      })
    ]
  }
})
