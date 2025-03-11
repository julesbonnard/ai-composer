import Heading from '@tiptap/extension-heading'

export default Heading.extend({
  name: 'headline',
  parseHTML: () => [{ tag: 'h1:first-child' }]
}).configure({ levels: [1] })
