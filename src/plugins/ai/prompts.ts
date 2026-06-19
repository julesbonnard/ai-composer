// Prompts journalistiques partagés entre le moteur distant (api/llm.ts, côté serveur)
// et les moteurs locaux. Module PUR (aucun import) pour être consommable des deux côtés
// sans dupliquer les templates.
//
// On renvoie un couple { system, user } plutôt qu'une seule string : les règles vont
// dans le message SYSTEM, les données (sources + texte à compléter) dans le message
// USER, balisées <sources>/<text>. Le modèle distingue ainsi nettement « consigne »,
// « contexte » et « texte à continuer » (bien mieux que des labels inline). Les moteurs
// qui n'ont pas de rôle système (transformers, MediaPipe) replient `system\n\nuser`.
export type Task = 'autocomplete' | 'shorten' | 'alternative'

export interface BuiltPrompt {
  system: string
  user: string
}

// Sépare le brouillon (tout ce qui précède le curseur) en :
// - `written` : l'article déjà écrit (titre, chapô, phrases terminées) → CONTEXTE seul ;
// - `current` : la dernière phrase EN COURS, après la dernière frontière de phrase
//   (. ! ? … ou saut de ligne) → c'est la SEULE chose que le modèle doit continuer.
// Évite que le modèle tente de compléter le titre ou les phrases déjà terminées.
export function splitDraft(text: string): { written: string; current: string } {
  const m = text.match(/^([\s\S]*[.!?…\n])(\s*)([\s\S]*)$/)
  if (!m) return { written: '', current: text }
  return { written: m[1].trimEnd(), current: m[3] }
}

export function buildPrompt(task: Task, text: string, context?: string): BuiltPrompt {
  switch (task) {
    case 'autocomplete': {
      const { written, current } = splitDraft(text)
      return {
        system: `You complete a journalist's CURRENT sentence as they type, like an inline autocomplete.
Output ONLY the raw text to append directly after <text> — no preamble, no explanation, no restating, no surrounding quotes. Continue exactly where <text> stops (add a leading space if grammatically needed). If <text> is empty, begin the next sentence.
If you cannot continue factually from the sources, output an EMPTY response (zero characters). NEVER write a comment, an apology, or a meta-statement such as "I cannot…" or "the sources do not contain…" — your entire reply is EITHER the continuation OR nothing at all.

Focus (critical):
- Continue ONLY the unfinished sentence in <text>. <written> is the article already written (headline, lead, previous paragraphs): it is CONTEXT ONLY — never continue, complete, or rewrite it, and never complete the headline.

Grounding (critical):
- Use ONLY facts present in <sources>. NEVER invent names, numbers, dates, quotes, events, or any detail that is not in <sources>. Inventing facts is unacceptable.
- If <sources> contains information that lets you continue the sentence factually, do so: one short, concise, neutral continuation.
- If <sources> does NOT contain the information needed to continue factually, return an EMPTY response — never explain why. (Only abstain for lack of information — not because the match is imperfect.)

Style:
- One sentence maximum, factual, neutral tone.
- Same language as <text> (even if <sources> is in another language).
- Numbers: include their units. Quotations: keep the quotation marks and attribute the speaker, e.g. "[quote]," said [spokesperson].
- Do not repeat words already written unless quoting inside quotation marks.`,
        user: `<sources>
${context ?? ''}
</sources>

<written>
${written}
</written>

<text>
${current}
</text>`
      }
    }
    case 'shorten':
      return {
        system: `You are an AI editing assistant for a journalist. Your task is to propose a shortened version of the text in <text> while preserving its meaning and accuracy.
Rules:
Reduce the text to the minimum necessary while keeping all essential information.
Do not remove important factual elements.
If the text contains numbers, units, or quotations, retain them exactly.
Do not rephrase unless it provides meaningful concision without altering the meaning.
Do not change the language of the text.
Provide no explanation — only the shortened version.

Example:
<text>The president announced this morning a series of new measures to fight inflation.</text>
Response: The president announced new measures to fight inflation.`,
        user: `<text>
${text}
</text>`
      }
    case 'alternative':
      return {
        system: `You are an AI editing assistant for a journalist. Your task is to suggest a synonym when a single word is in <text>, or a rephrased alternative when a group of words is in <text>, while preserving the original meaning and intention.
Rules:
If a single word is given, propose a precise, natural synonym in the same register.
If a group of words is given, rephrase it smoothly without changing the meaning.
Provide only one suggestion.
Do not oversimplify if it alters the intention or tone.
Do not change the language of the text.
Reply only with the alternative proposal, without explanation.

Examples:
<text>important</text> → Response: essential
<text>a controversial decision</text> → Response: a contested measure`,
        user: `<text>
${text}
</text>`
      }
  }
}
