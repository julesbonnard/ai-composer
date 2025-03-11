import Paragraph from '@tiptap/extension-paragraph'

const Lead = Paragraph.extend({
  name: 'lead',
  content: 'text*',
  parseHTML: () => [{ tag: 'p:first-child' }]
}).configure({ 
  HTMLAttributes: {
    class: 'lead'
  }
})

export default Lead