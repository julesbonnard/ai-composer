// Pont entre le cœur stylecheck (offsets de texte plat) et ProseMirror
// (positions de doc) — LE problème dur signalé dans stylecheck/CLAUDE.md.
//
// Stratégie v1 (démo, couche déterministe) : on lint BLOC PAR BLOC. Le texte
// d'un nœud commence à `pos + 1`, donc un offset o dans ce texte se mappe en
// position PM `pos + 1 + o`. Pas de mapping flat↔doc à l'échelle du document :
// chaque diagnostic reste ancré dans son bloc. (Le mapping async sur snapshot
// via decorationSet.map viendra avec la couche LLM.)

import { Decoration } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { lint } from 'stylecheck'
import type { Diagnostic, Dispatch, DispatchMeta, Field } from 'stylecheck'

/** Un diagnostic positionné dans le doc ProseMirror (pour le panneau + décorations). */
export interface PositionedDiagnostic extends Diagnostic {
  from: number // position PM de début
  to: number // position PM de fin
  blockLevel: boolean // true = porte sur tout le bloc (longueur) → panneau seul
}

/** Nœuds dont on lint le contenu, et le champ stylecheck correspondant. */
const FIELD_BY_NODE: Record<string, Field> = {
  headline: 'headline',
  lead: 'text',
  paragraph: 'text',
  heading: 'text',
}

export interface LintResult {
  decorations: Decoration[]
  diagnostics: PositionedDiagnostic[]
}

/** Lint un doc ProseMirror et renvoie décorations inline + liste positionnée. */
export function lintDoc(doc: PMNode, meta: DispatchMeta): LintResult {
  const decorations: Decoration[] = []
  const diagnostics: PositionedDiagnostic[] = []

  doc.descendants((node, pos) => {
    const field = FIELD_BY_NODE[node.type.name]
    if (!field) return true

    const text = node.textContent
    if (!text) return false

    // Mini-dépêche par bloc : le champ dépend du type de nœud.
    const dispatch =
      field === 'headline'
        ? { headline: text, text: '', meta }
        : { text, meta }

    const blockStart = pos + 1 // le contenu inline débute à pos + 1

    for (const diag of lint(dispatch)) {
      const from = blockStart + diag.span.start
      const to = blockStart + diag.span.end
      // Diagnostic « bloc entier » (règle de longueur) → panneau seul, pas de squiggle.
      const blockLevel = diag.span.start === 0 && diag.span.end === text.length

      diagnostics.push({ ...diag, from, to, blockLevel })

      if (!blockLevel) {
        const tip = diag.suggestion
          ? `${diag.message}\n💡 ${diag.suggestion}`
          : diag.message
        decorations.push(
          Decoration.inline(from, to, {
            class: `stylecheck-diag stylecheck-${diag.severity}`,
            'data-rule': diag.ruleId,
            title: tip,
          }),
        )
      }
    }
    return false // pas de descente dans les inline
  })

  return { decorations, diagnostics }
}

// --- Couche SÉMANTIQUE (agent IA, à la demande) ------------------------------
// judge() raisonne sur la dépêche à plat (headline + corps concaténé). Pour
// ancrer ses diagnostics, on construit la dépêche EN GARDANT la correspondance
// offset-texte → position ProseMirror (par bloc), puis on remappe les spans.

interface FieldBlock {
  field: Field
  pmStart: number // position PM du début de contenu du nœud (pos + 1)
  textStart: number // offset de ce bloc dans le texte à plat du champ
  text: string
}

/** Construit la Dispatch depuis le doc + la carte offset↔position par bloc. */
export function buildDispatch(
  doc: PMNode,
  meta: DispatchMeta,
): { dispatch: Dispatch; blocks: FieldBlock[] } {
  const blocks: FieldBlock[] = []
  let headline = ''
  const bodyTexts: string[] = []
  let cursor = 0

  doc.descendants((node, pos) => {
    const field = FIELD_BY_NODE[node.type.name]
    if (!field) return true
    const text = node.textContent
    if (field === 'headline') {
      headline = text
      blocks.push({ field: 'headline', pmStart: pos + 1, textStart: 0, text })
    } else {
      blocks.push({ field: 'text', pmStart: pos + 1, textStart: cursor, text })
      bodyTexts.push(text)
      cursor += text.length + 1 // +1 pour le '\n' de jointure
    }
    return false
  })

  const dispatch: Dispatch = {
    headline: headline || undefined,
    text: bodyTexts.join('\n'),
    meta,
  }
  return { dispatch, blocks }
}

/** Remappe les Diagnostic sémantiques (offsets à plat) vers des positions PM. */
export function positionSemantic(
  diagnostics: Diagnostic[],
  blocks: FieldBlock[],
  dispatch: Dispatch,
): PositionedDiagnostic[] {
  return diagnostics.map((diag) => {
    const fieldBlocks = blocks.filter((b) => b.field === diag.span.field)
    const fieldLen =
      diag.span.field === 'headline' ? (dispatch.headline?.length ?? 0) : dispatch.text.length
    // Span « champ entier » (non localisé par le juge) → panneau seul, pas de squiggle.
    const blockLevel = diag.span.start === 0 && diag.span.end >= fieldLen

    if (blockLevel || fieldBlocks.length === 0) {
      const from = fieldBlocks[0]?.pmStart ?? 1
      return { ...diag, from, to: from, blockLevel: true }
    }

    const startBlock =
      fieldBlocks.find(
        (b) => diag.span.start >= b.textStart && diag.span.start < b.textStart + b.text.length,
      ) ?? fieldBlocks[0]
    const from = startBlock.pmStart + (diag.span.start - startBlock.textStart)
    const blockEnd = startBlock.pmStart + startBlock.text.length
    const to = Math.min(startBlock.pmStart + (diag.span.end - startBlock.textStart), blockEnd)
    return { ...diag, from, to: Math.max(to, from + 1), blockLevel: false }
  })
}
