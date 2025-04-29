import Highlight from '@tiptap/extension-highlight'

const Completion = Highlight.extend({
  name: 'completion',
  content: 'text*',
  parseHTML: () => [{ tag: 'mark.completion' }],
  addAttributes: () => ({
    title: {
      default: ''
    },
    'data-id': {
      default: ''
    }
  })
}).configure({
  HTMLAttributes: {
    class: 'completion'
  }
})

export default Completion
