import { reactive } from 'vue'

// Cible de surlignage demandée depuis un passage IA (clic « Source »).
// SourceEditor.vue observe `nonce` pour (re)déclencher le surlignage, même quand on
// reste sur la même source. La plage (offset/len) est la position du segment source
// d'origine ; offset < 0 = pas de plage connue (anciennes complétions → pas de surlignage).

export const sourceHighlight = reactive({
  sourceId: '',
  offset: -1,
  len: 0,
  nonce: 0,
  // Incrémenté pour DEMANDER le retrait du surlignage (p.ex. fermeture du tooltip
  // de revue côté article) ; SourceEditor.vue l'observe.
  clearNonce: 0
})

export function requestSourceHighlight(sourceId: string, offset: number, len: number) {
  sourceHighlight.sourceId = sourceId
  sourceHighlight.offset = offset
  sourceHighlight.len = len
  sourceHighlight.nonce++
}

export function clearSourceHighlight() {
  sourceHighlight.clearNonce++
}
