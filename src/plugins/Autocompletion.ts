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

// Une proposition de complétion : appelée pour (re)générer, avec un onChunk optionnel
// qui reçoit la complétion partielle au fil du streaming (ghost text progressif).
export type CompletionThunk = (onChunk?: (partial: Completion) => void) => Promise<Completion>

export interface AutocompletionOptions {
  autocompletion: (draftBeforeCursor: string, paragraph: string) => Promise<CompletionThunk[]>
  shorten: (text: string) => Promise<any>
  alternative: (text: string) => Promise<any>
  cancel: () => void
  debounceTimer: number
}

export interface AutocompletionStorage {
  debouncedGetCompletions: any
  suggestCompletion: any
  shorten: (view: EditorView, text: string, from: number, to: number) => Promise<void>
  alternative: (view: EditorView, text: string, from: number, to: number) => Promise<void>
  availableCompletions: CompletionThunk[]
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
      cancel: () => {},
      debounceTimer: 100
    }
  },

  addStorage() {
    const suggestCompletion = async (
      view: EditorView,
      node: Node,
      pos: number,
      availableCompletions: CompletionThunk[],
      currentCompletionIndex: number
    ) => {
      if (availableCompletions[currentCompletionIndex] == null) return

      // Pose/replace la décoration ghost text et synchronise l'état (navigation +
      // insertion Tab). Appelé à chaque incrément de streaming puis une dernière
      // fois sur le résultat final.
      const renderCompletion = (answer: string, context: Completion['context']) => {
        const title = context.metadata.title ?? context.metadata.name ?? ''
        const decoration = Decoration.node(pos, pos + node.nodeSize, {
          class: 'autocompletion',
          'data-autocompletion': `${answer} (${title})`
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

      let result: Completion
      try {
        result = await availableCompletions[currentCompletionIndex]((partial) => {
          if (partial.answer) renderCompletion(partial.answer, partial.context)
        })
      } catch {
        // Erreur déjà signalée par un toast (engine.ts) ; on retire le placeholder « … ».
        view.dispatch(view.state.tr.setMeta(pluginKey, { action: 'remove' }))
        return
      }
      renderCompletion(result.answer, result.context)
    }

    const getCompletionsWrapper = async (view: EditorView, node: Node, pos: number) => {
      // Brouillon AVANT le curseur (tous blocs confondus, séparés par \n), plafonné :
      // c'est la continuation donnée au LLM. La requête de ranking en dérive (fin du
      // brouillon, côté HomeView). On n'envoie jamais le texte situé APRÈS le curseur.
      const cursor = view.state.selection.anchor
      const DRAFT_CAP = 12000
      const before = view.state.doc.textBetween(0, cursor, '\n', ' ')
      const draft = before.length > DRAFT_CAP ? before.slice(-DRAFT_CAP) : before
      // Paragraphe COURANT (du début du bloc au curseur) : sert de requête de ranking
      // — unité sémantique nette, sans déborder sur le paragraphe précédent.
      const paragraph = view.state.doc.textBetween(view.state.selection.$from.start(), cursor, '\n', ' ')
      let availableCompletions: (() => Promise<Completion>)[]
      try {
        availableCompletions = await this.options.autocompletion(draft, paragraph)
      } catch {
        // Erreur (embeddings/contexte) déjà signalée en amont ; on retire le placeholder.
        view.dispatch(view.state.tr.setMeta(pluginKey, { action: 'remove' }))
        return
      }
      if (availableCompletions.length == 0) {
        view.dispatch(view.state.tr.setMeta(pluginKey, { action: 'remove' }))
        return
      }

      suggestCompletion(view, node, pos, availableCompletions, 0)
    }

    // Remplace [from, to] par le texte transformé, marqué comme généré par l'IA
    // (mark `completion`) pour qu'il soit signalé et révisable comme une complétion.
    const replaceWithCompletion = (
      view: EditorView,
      content: string,
      from: number,
      to: number,
      kind: 'shorten' | 'alternative'
    ) => {
      if (content) {
        const mark = view.state.schema.marks.completion.create({ 'data-kind': kind })
        const textNode = view.state.schema.text(content, [mark])
        view.dispatch(view.state.tr.replaceWith(from, to, textNode))
      }
      view.dispatch(view.state.tr.setMeta(pluginKey, { action: 'remove' }))
    }

    const shorten = async (view: EditorView, text: string, from: number, to: number) => {
      try {
        const content = await this.options.shorten(text)
        replaceWithCompletion(view, content, from, to, 'shorten')
      } catch {
        // Toast déjà émis par engine.ts ; on retire le placeholder de remplacement.
        view.dispatch(view.state.tr.setMeta(pluginKey, { action: 'remove' }))
      }
    }

    const alternative = async (view: EditorView, text: string, from: number, to: number) => {
      try {
        const content = await this.options.alternative(text)
        replaceWithCompletion(view, content, from, to, 'alternative')
      } catch {
        view.dispatch(view.state.tr.setMeta(pluginKey, { action: 'remove' }))
      }
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
                // Une seule décoration ghost active à la fois : on remplace (le
                // placeholder « … » puis chaque incrément de streaming se succèdent
                // sans s'empiler).
                set = DecorationSet.create(tr.doc, [decoration])
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
        // Coupe la requête en cours (réseau ou calcul navigateur), pas seulement l'affichage.
        this.options.cancel()
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
          const { context, answer } = this.storage.currentCompletion
          // Plage source (offset + longueur) conservée sur la mark pour resurligner
          // le segment d'origine à l'ouverture de la source.
          const esc = (s: string) =>
            s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
          const offset = context.metadata.offset ?? 0
          const len = (context.pageContent ?? '').length
          this.editor
            .chain()
            .insertContent(
              `<mark class="completion" data-kind="source" data-id="${context.id}" data-source="${esc(context.metadata.title ?? '')}" data-offset="${offset}" data-len="${len}">${answer}</mark> `
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
