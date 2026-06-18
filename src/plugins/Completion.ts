import Highlight from '@tiptap/extension-highlight'

const Completion = Highlight.extend({
  name: 'completion',
  content: 'text*',
  parseHTML: () => [{ tag: 'mark.completion' }],
  addAttributes: () => ({
    // Provenance (nom de la source). Sur data-source plutôt que title pour
    // piloter le tooltip custom sans déclencher l'infobulle native du navigateur.
    // Repli sur l'ancien attribut title pour les contenus déjà saisis.
    'data-source': {
      default: '',
      parseHTML: (el: HTMLElement) =>
        el.getAttribute('data-source') || el.getAttribute('title') || '',
      renderHTML: (attrs: Record<string, string>) =>
        attrs['data-source'] ? { 'data-source': attrs['data-source'] } : {}
    },
    'data-id': {
      default: '',
      parseHTML: (el: HTMLElement) => el.getAttribute('data-id') || '',
      renderHTML: (attrs: Record<string, string>) =>
        attrs['data-id'] ? { 'data-id': attrs['data-id'] } : {}
    },
    // Origine du passage : 'source' (complétion depuis une source), 'shorten' ou
    // 'alternative' (transformations IA d'une sélection). Pilote le libellé du tooltip.
    'data-kind': {
      default: 'source',
      parseHTML: (el: HTMLElement) => el.getAttribute('data-kind') || 'source',
      renderHTML: (attrs: Record<string, string>) =>
        attrs['data-kind'] ? { 'data-kind': attrs['data-kind'] } : {}
    },
    // Position (offset, en caractères) et longueur du segment source ayant servi à
    // générer la complétion. Le texte affiché étant généré par l'IA, il ne se
    // retrouve pas tel quel dans la source : on conserve donc la plage d'origine
    // pour la resurligner exactement à l'ouverture.
    'data-offset': {
      default: '',
      parseHTML: (el: HTMLElement) => el.getAttribute('data-offset') || '',
      renderHTML: (attrs: Record<string, string>) =>
        attrs['data-offset'] ? { 'data-offset': attrs['data-offset'] } : {}
    },
    'data-len': {
      default: '',
      parseHTML: (el: HTMLElement) => el.getAttribute('data-len') || '',
      renderHTML: (attrs: Record<string, string>) =>
        attrs['data-len'] ? { 'data-len': attrs['data-len'] } : {}
    }
  })
}).configure({
  HTMLAttributes: {
    class: 'completion'
  }
})

export default Completion
