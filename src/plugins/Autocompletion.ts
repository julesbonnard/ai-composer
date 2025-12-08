import { Extension } from '@tiptap/core'
import { Node } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view'
import debounce from 'lodash.debounce'

declare module '@tiptap/core' {
  interface Commands {
    autocompletion: {
      shorten: () => any
      alternative: () => any
    }
  }
}

export interface AutocompletionOptions {
  autocompletion: (text: string, fullText: string) => Promise<(() => Promise<Completion>)[]>
  shorten: (text: string) => Promise<any>
  alternative: (text: string) => Promise<any>
  debounceTimer: number
}

export interface AutocompletionStorage {
  debouncedGetCompletions: any
  suggestCompletion: any
  shorten: (view: EditorView, text: string, from: number, to: number) => Promise<void>
  alternative: (view: EditorView, text: string, from: number, to: number) => Promise<void>
  availableCompletions: (() => Promise<Completion>)[]
  currentCompletionIndex: number
  currentCompletion: Completion
  setPlaceholder: (view: EditorView, node: Node, pos: number) => void
  setReplacePlaceholder: (view: EditorView, from: number, to: number) => void
  unsetDecorations: (view: EditorView) => void
}

const pluginKey = new PluginKey('autocompletion')

export default Extension.create<AutocompletionOptions, AutocompletionStorage>({
  name: 'autocompletion',

  addOptions() {
    return {
      autocompletion: () => Promise.resolve([]),
      shorten: () => Promise.resolve(''),
      alternative: () => Promise.resolve(''),
      debounceTimer: 100
    }
  },

  addStorage() {
    const suggestCompletion = async (
      view: EditorView,
      node: Node,
      pos: number,
      availableCompletions: (() => Promise<Completion>)[],
      currentCompletionIndex: number
    ) => {
      if (availableCompletions[currentCompletionIndex] == null) return
      const result = await availableCompletions[currentCompletionIndex]()
      const { answer, context } = result
      const decoration = Decoration.node(pos, pos + node.nodeSize, {
        class: 'autocompletion',
        'data-autocompletion': `${answer} (${context.metadata.title})`
      })
      view.dispatch(
        view.state.tr.setMeta(pluginKey, {
          action: 'add',
          decoration,
          availableCompletions,
          currentCompletionIndex,
          currentCompletion: { answer, context }
        })
      )
    }

    const getCompletionsWrapper = async (view: EditorView, node: Node, pos: number) => {
      const fullText = view.state.doc.textContent
      const availableCompletions = await this.options.autocompletion(node.textContent, fullText)
      if (availableCompletions.length == 0) {
        view.dispatch(view.state.tr.setMeta(pluginKey, { action: 'remove' }))
      }

      suggestCompletion(view, node, pos, availableCompletions, 0)
    }

    const shorten = async (view: EditorView, text: string, from: number, to: number) => {
      const content = await this.options.shorten(text)
      if (content) {
        view.dispatch(view.state.tr.replaceWith(from, to, view.state.schema.text(content)))
      }
      view.dispatch(view.state.tr.setMeta(pluginKey, { action: 'remove' }))
    }

    const alternative = async (view: EditorView, text: string, from: number, to: number) => {
      const content = await this.options.alternative(text)
      if (content) {
        view.dispatch(view.state.tr.replaceWith(from, to, view.state.schema.text(content)))
      }
      view.dispatch(view.state.tr.setMeta(pluginKey, { action: 'remove' }))
    }

    return {
      debouncedGetCompletions: debounce(getCompletionsWrapper, this.options.debounceTimer),
      suggestCompletion,
      shorten,
      alternative,
      availableCompletions: [],
      currentCompletionIndex: 0,
      currentCompletion: {
        answer: '',
        context: { id: '', pageContent: '', metadata: { name: '' } }
      },
      setPlaceholder: (view: EditorView, node: Node, pos: number) => {
        const decoration = Decoration.node(pos, pos + node.nodeSize, {
          class: 'autocompletion',
          'data-autocompletion': '...'
        })
        view.dispatch(view.state.tr.setMeta(pluginKey, { action: 'add', decoration }))
      },
      setReplacePlaceholder: (view: EditorView, from: number, to: number) => {
        const decoration = Decoration.inline(from, to, {
          class: 'autocompletion inline',
          'data-autocompletion': '...'
        })
        view.dispatch(view.state.tr.setMeta(pluginKey, { action: 'add', decoration }))
      },
      unsetDecorations: (view: EditorView) => {
        view.dispatch(view.state.tr.setMeta(pluginKey, { action: 'remove' }))
      }
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init: () => {
            return DecorationSet.empty
          },
          apply: (tr, set) => {
            // Adjust decoration positions to changes made by the transaction
            set = set.map(tr.mapping, tr.doc)

            const completion = tr.getMeta(pluginKey)
            if (completion) {
              const {
                action,
                availableCompletions,
                currentCompletionIndex,
                currentCompletion,
                decoration
              } = completion
              if (availableCompletions) this.storage.availableCompletions = availableCompletions
              if (currentCompletionIndex !== undefined)
                this.storage.currentCompletionIndex = currentCompletionIndex
              if (currentCompletion) this.storage.currentCompletion = currentCompletion
              if (action == 'remove') {
                set = DecorationSet.empty
              } else if (action == 'add') {
                set = set.add(tr.doc, [decoration])
              } else if (action == 'reset') {
                this.storage.availableCompletions = []
                this.storage.currentCompletionIndex = 0
                this.storage.currentCompletion = {
                  answer: '',
                  context: { metadata: { name: '' }, pageContent: '', id: '' }
                }
              }
            }
            return set
          }
        },
        props: {
          decorations(state) {
            return this.getState(state)
          }
        }
      })
    ]
  },

  addKeyboardShortcuts() {
    return {
      ArrowDown: () => {
        if (this.storage.availableCompletions.length == 0) return false
        if (this.storage.currentCompletionIndex >= this.storage.availableCompletions.length - 1)
          return false
        this.storage.unsetDecorations(this.editor.view)
        const { anchor } = this.editor.state.selection
        this.editor.state.doc.descendants((node, pos) => {
          const hasAnchor = anchor == pos + node.nodeSize - 1
          const isEmpty = !node.isLeaf && !node.childCount

          if (hasAnchor && !isEmpty) {
            this.storage.setPlaceholder(this.editor.view, node, pos)
            this.storage.suggestCompletion(
              this.editor.view,
              node,
              pos,
              this.storage.availableCompletions,
              this.storage.currentCompletionIndex + 1
            )
          }
        })
        return true
      },
      ArrowUp: () => {
        if (this.storage.availableCompletions.length == 0) return false
        if (this.storage.currentCompletionIndex <= 0) return false
        this.storage.unsetDecorations(this.editor.view)
        const { anchor } = this.editor.state.selection
        this.editor.state.doc.descendants((node, pos) => {
          const hasAnchor = anchor == pos + node.nodeSize - 1
          const isEmpty = !node.isLeaf && !node.childCount

          if (hasAnchor && !isEmpty) {
            this.storage.setPlaceholder(this.editor.view, node, pos)
            this.storage.suggestCompletion(
              this.editor.view,
              node,
              pos,
              this.storage.availableCompletions,
              this.storage.currentCompletionIndex - 1
            )
          }
        })
        return true
      },
      Escape: () => {
        this.storage.unsetDecorations(this.editor.view)
        this.storage.debouncedGetCompletions.cancel()
        this.editor.view.dispatch(
          this.editor.view.state.tr.setMeta(pluginKey, { action: 'remove' })
        )
        this.editor.view.dispatch(this.editor.view.state.tr.setMeta(pluginKey, { action: 'reset' }))
        return true
      },
      Tab: () => {
        if (this.storage.availableCompletions.length == 0) {
          const { anchor } = this.editor.state.selection

          this.editor.state.doc.descendants((node, pos) => {
            const hasAnchor = anchor == pos + node.nodeSize - 1
            const isEmpty = !node.isLeaf && !node.childCount

            if (hasAnchor && !isEmpty) {
              this.storage.setPlaceholder(this.editor.view, node, pos)
              this.editor.view.dispatch(
                this.editor.view.state.tr.setMeta(pluginKey, { action: 'reset' })
              )
              this.storage.debouncedGetCompletions(this.editor.view, node, pos)
            }
          })
        } else if (this.storage.currentCompletion.answer) {
          this.editor
            .chain()
            .insertContent(
              `<mark class="completion" data-id="${this.storage.currentCompletion.context.id}" title="${this.storage.currentCompletion.context.metadata.title}">${this.storage.currentCompletion.answer}</mark> `
            )
            .run()
          this.editor.view.dispatch(
            this.editor.view.state.tr.setMeta(pluginKey, { action: 'reset' })
          )
          this.storage.unsetDecorations(this.editor.view)
        }
        return true
      }
    }
  },

  addCommands() {
    return {
      shorten:
        () =>
        ({ chain }: any) => {
          const { from, to } = this.editor.state.selection
          const text = this.editor.state.doc.textBetween(from, to)

          this.storage.setReplacePlaceholder(this.editor.view, from, to)
          this.storage.shorten(this.editor.view, text, from, to)
          return chain().run()
        },
      alternative:
        () =>
        ({ chain }: any) => {
          const { from, to } = this.editor.state.selection
          const text = this.editor.state.doc.textBetween(from, to)

          this.storage.setReplacePlaceholder(this.editor.view, from, to)
          this.storage.alternative(this.editor.view, text, from, to)
          return chain().run()
        }
    }
  },

  onSelectionUpdate() {
    if (this.storage.availableCompletions.length > 0) {
      this.editor.view.dispatch(this.editor.view.state.tr.setMeta(pluginKey, { action: 'reset' }))
      this.storage.unsetDecorations(this.editor.view)
    }
  }
})
