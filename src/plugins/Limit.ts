import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

interface NodeLimit {
  charCount?: number
  wordCount?: number
}

export interface LimitOptions {
  limits: Record<string, NodeLimit>
}

export default Extension.create<LimitOptions>({
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
              const limit = this.options.limits[nodeType]
              if (limit) {
                if (limit.charCount) {
                  const charCount = node.textContent.length
                  if (charCount > limit.charCount) {
                    decorations.push(
                      Decoration.inline(
                        pos + limit.charCount,
                        pos + node.nodeSize,
                        {
                          'data-limit': 'char',
                          class: 'unvalid'
                        }
                      )
                    )
                  }
                } else if (limit.wordCount) {
                  const wordCount = limit.wordCount
                  const counter = node.textContent.split('').reduce(
                    (acc, cur) => {
                      if (cur == ' ') {
                        acc.words++
                      }
                      if (acc.words < wordCount) {
                        acc.chars++
                      }
                      return acc
                    },
                    {
                      words: 0,
                      chars: 2
                    }
                  )
                  if (counter.words >= wordCount) {
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
