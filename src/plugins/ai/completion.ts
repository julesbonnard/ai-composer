import { complete } from './engine'
import { splitDraft } from './prompts'

// API de complétion, agnostique du moteur (local ou distant) : tout passe par
// engine.complete(), qui choisit l'implémentation selon le provider sélectionné.

// Source résolue pour une complétion : `context` est ce qui part au LLM (contenu
// entier si la source est courte, top-chunks sinon — cf. buildSourceContext).
export interface CompletionSource {
  id: string
  title: string
  context: string
}

export async function autocompleteText(
  draft: string,
  source: CompletionSource,
  onChunk?: (partial: Completion) => void
): Promise<Completion> {
  // Attribution portée par la mark : on garde le lien vers la source (id + nom).
  // offset = -1 → pas de segment précis à resurligner (on envoie la source entière /
  // ses top-chunks, pas un paragraphe unique), pageContent '' → data-len 0.
  const attribute = (answer: string): Completion => ({
    answer,
    context: { id: source.id, pageContent: '', metadata: { id: source.id, title: source.title, offset: -1 } }
  })

  // Le modèle rejoue parfois la phrase en cours en préfixe : on la retire pour ne
  // garder que la suite. On se base sur la PHRASE EN COURS (pas tout le brouillon),
  // puisque c'est elle que le modèle continue désormais.
  const { current } = splitDraft(draft)
  const visible = (raw: string): string => {
    const lower = raw.toLowerCase()
    const t = current.toLowerCase()
    if (t && lower.startsWith(t)) return raw.slice(current.length)
    if (t && t.startsWith(lower)) return ''
    return raw
  }

  let acc = ''
  const answer = await complete('autocomplete', draft, source.context, (delta) => {
    acc += delta
    onChunk?.(attribute(visible(acc)))
  })

  return attribute(visible(answer))
}

export function shortenText(text: string): Promise<string> {
  return complete('shorten', text)
}

export function alternativeText(text: string): Promise<string> {
  return complete('alternative', text)
}
