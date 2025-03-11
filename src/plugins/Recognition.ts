import Highlight from '@tiptap/extension-highlight'

const Recognition = Highlight.extend({
  name: 'recognition',
  content: 'text*',
  parseHTML: () => [{ tag: 'mark.recognition' }],
  addAttributes: () => ({
    title: {
      default: '',
    }
  })
}).configure({ 
  HTMLAttributes: {
    class: 'recognition'
  }
})

export default Recognition