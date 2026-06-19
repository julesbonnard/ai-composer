// Extraction PDF **structurée** : reconstruit titres et paragraphes à partir de la
// géométrie des items pdfjs (position + taille de police), au lieu de concaténer
// bêtement `item.str`. Produit du Markdown → les titres deviennent des bornes de
// chunk naturelles et les paragraphes sont propres (cf. couche 1 du chunking PDF).
//
// ⚠️ Heuristiques à affiner sur de vrais PDF. Limites connues (volontairement non
// traitées ici) : multi-colonnes (l'ordre de lecture peut s'entremêler) et tableaux
// (rendus en lignes de texte). À itérer selon le corpus.

// Forme minimale d'un item texte pdfjs (cf. pdfjs-dist TextItem) — typé localement
// pour ne pas dépendre des types internes de pdfjs.
interface RawTextItem {
  str: string
  transform: number[] // matrice affine [a,b,c,d,e,f] : e=x, f=y
  height: number
  width: number
  fontName: string
  hasEOL: boolean
}

interface PdfLike {
  numPages: number
  getPage(n: number): Promise<{
    getTextContent(): Promise<{ items: Array<RawTextItem | { type?: string }> }>
  }>
}

interface Line {
  text: string
  y: number
  fontSize: number
}

// Taille de police d'un item : `height` est fiable pour du texte non pivoté ; repli
// sur la norme du vecteur d'échelle de la matrice.
function itemFontSize(it: RawTextItem): number {
  if (it.height && it.height > 0) return it.height
  return Math.hypot(it.transform[2] ?? 0, it.transform[3] ?? 0)
}

// Regroupe les items d'une page en lignes (même `y` à tolérance près), triées de
// haut en bas (y décroissant en PDF), items gauche→droite dans chaque ligne.
function itemsToLines(items: RawTextItem[]): Line[] {
  const sorted = [...items].sort((a, b) => {
    const dy = b.transform[5] - a.transform[5]
    if (Math.abs(dy) > Math.max(a.height, b.height) * 0.5) return dy
    return a.transform[4] - b.transform[4]
  })

  const lines: Line[] = []
  let current: { items: RawTextItem[]; y: number } | null = null
  for (const it of sorted) {
    const y = it.transform[5]
    const tol = Math.max(itemFontSize(it), 1) * 0.5
    if (current && Math.abs(current.y - y) <= tol) {
      current.items.push(it)
    } else {
      if (current) lines.push(buildLine(current.items, current.y))
      current = { items: [it], y }
    }
  }
  if (current) lines.push(buildLine(current.items, current.y))
  return lines
}

function buildLine(items: RawTextItem[], y: number): Line {
  const text = items
    .map((i) => i.str)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  // Taille de la ligne = taille dominante de ses items (la plus fréquente).
  const fontSize = mode(items.map((i) => Math.round(itemFontSize(i)))) || 0
  return { text, y, fontSize }
}

function mode(nums: number[]): number {
  const counts = new Map<number, number>()
  let best = 0
  let bestCount = 0
  for (const n of nums) {
    const c = (counts.get(n) ?? 0) + 1
    counts.set(n, c)
    if (c > bestCount) {
      bestCount = c
      best = n
    }
  }
  return best
}

// Niveau de titre selon la taille relative au corps (paliers). 0 = corps de texte.
function headingLevel(fontSize: number, bodySize: number): number {
  if (bodySize <= 0) return 0
  const ratio = fontSize / bodySize
  if (ratio >= 1.8) return 1
  if (ratio >= 1.4) return 2
  if (ratio >= 1.15) return 3
  return 0
}

export async function extractStructuredText(pdf: PdfLike): Promise<string> {
  const pageLines: Line[][] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const items = content.items.filter((i): i is RawTextItem => 'str' in i)
    pageLines.push(itemsToLines(items))
  }

  const allLines = pageLines.flat().filter((l) => l.text !== '')
  if (allLines.length === 0) return ''

  // Taille de corps = taille de ligne la plus fréquente (pondérée par longueur de
  // texte pour ne pas laisser quelques gros titres fausser la médiane).
  const bodySize = mode(
    allLines.flatMap((l) => Array(Math.max(1, Math.ceil(l.text.length / 20))).fill(l.fontSize))
  )

  const out: string[] = []
  let paragraph: string[] = []
  let prevY: number | null = null
  let prevFont = 0

  const flush = () => {
    if (paragraph.length) {
      out.push(paragraph.join(' '))
      paragraph = []
    }
  }

  for (const line of allLines) {
    const level = headingLevel(line.fontSize, bodySize)
    if (level > 0) {
      flush()
      out.push(`${'#'.repeat(level)} ${line.text}`)
      prevY = null
      prevFont = line.fontSize
      continue
    }
    // Saut de paragraphe : grand écart vertical, ou changement de taille de police.
    const bigGap =
      prevY !== null && Math.abs(prevY - line.y) > Math.max(line.fontSize, bodySize) * 1.6
    const fontChange = prevFont > 0 && Math.abs(prevFont - line.fontSize) > 0.5
    if (bigGap || fontChange) flush()
    paragraph.push(line.text)
    prevY = line.y
    prevFont = line.fontSize
  }
  flush()

  // Paragraphes séparés par une ligne vide (cohérent avec le découpage paragraphe
  // du vector store, qui sépare sur les sauts de ligne).
  return out.join('\n\n')
}
