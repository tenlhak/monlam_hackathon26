/**
 * Stroke-order data model for the tracing engine.
 *
 * Authored once by hand (see features/authoring/StrokeAuthor), consumed at
 * runtime by the grader. Points are normalised to a 0–1 box so the data is
 * independent of canvas size, and the order of points within a stroke *is* the
 * writing direction.
 *
 * Ground truth for order, direction and stroke names is Christopher J. Fynn's
 * "how to write" diagrams on Wikimedia Commons (CC BY-SA 4.0), cross-checked
 * against Allexkoch's WebM animations. Note that Tibetan stroke order is not
 * fully standardised — this follows one dbu-can style.
 */

import { ALL_CONSONANTS } from '@/data/consonants'

export type NPoint = [number, number]

export interface AuthoredStroke {
  /** Traditional Tibetan name of the stroke, e.g. མགོ (head line). */
  name: string
  /** Centreline, normalised to 0–1. Point order is the writing direction. */
  points: NPoint[]
}

export interface AuthoredGlyph {
  glyph: string
  /** e.g. "0F40" */
  codepoint: string
  latin: string
  strokes: AuthoredStroke[]
}

/** The four vowel signs, traced on the ཨ base for context. */
export const VOWEL_TARGETS = [
  { glyph: 'ི', latin: 'gi gu', base: 'ཨ' },
  { glyph: 'ུ', latin: 'zhabs kyu', base: 'ཨ' },
  { glyph: 'ེ', latin: 'greng bu', base: 'ཨ' },
  { glyph: 'ོ', latin: 'na ro', base: 'ཨ' },
] as const

export interface AuthorTarget {
  glyph: string
  latin: string
  codepoint: string
  /** Rendered behind the tracing target for context; not traced itself. */
  base?: string
}

export const AUTHOR_TARGETS: AuthorTarget[] = [
  ...ALL_CONSONANTS.map((c) => ({
    glyph: c.glyph,
    latin: c.latin,
    codepoint: cp(c.glyph),
  })),
  ...VOWEL_TARGETS.map((v) => ({
    glyph: v.glyph,
    latin: v.latin,
    codepoint: cp(v.glyph),
    base: v.base,
  })),
]

export function cp(glyph: string): string {
  return (glyph.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Autocomplete suggestions only — not a closed set.
 *
 * Each letter names its own strokes in Fynn's diagrams, and the names differ
 * from letter to letter; only མགོ (the head line) is common to all of them.
 * The rest below were read off the ཀ diagram and are offered because they are
 * the ones seen so far, not because they are universal. Type whatever the
 * reference caption for the letter in hand actually says.
 */
export const STROKE_NAMES = [
  { bo: 'མགོ', latin: 'go — head line (all letters)' },
  { bo: 'མཆེ་བ', latin: 'che ba — fang (seen on ཀ)' },
  { bo: 'དབུས་ཡིག', latin: 'ü yig — centre stroke (seen on ཀ)' },
  { bo: 'ཀང་', latin: 'kang — leg (seen on ཀ)' },
]

/** Commons "how to write" reference for a glyph, or null if none exists. */
export function commonsReference(glyph: string): string | null {
  const file = commonsFile(glyph)
  if (!file) return null
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`
}

function commonsFile(glyph: string): string | null {
  const code = cp(glyph)

  // Fynn drew these three in a single diagram.
  if (['0F59', '0F5A', '0F5B'].includes(code)) {
    return 'Tibetan-U+0F59-U+0F5A-U+0F5B-TSA-TSHA-DZA.svg'
  }
  // All four vowel signs share one diagram.
  if (['0F72', '0F74', '0F7A', '0F7C'].includes(code)) {
    return 'Tibetan-U+0F72-U+0F74-U+0F7A-U+0F7C-VOWEL-MARKS.svg'
  }

  const target = AUTHOR_TARGETS.find((t) => t.glyph === glyph)
  if (!target) return null
  return `Tibetan-U+${code}-${target.latin.toUpperCase()}.svg`
}

// ─────────────────────────────────────────────── geometry

export interface Point {
  x: number
  y: number
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len
}

/**
 * Ramer–Douglas–Peucker. Raw pointer capture emits a point every few pixels;
 * this keeps the corners and drops the rest so the exported data stays small
 * and readable.
 */
export function simplify(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points

  let maxDist = 0
  let index = 0
  const first = points[0]
  const last = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last)
    if (dist > maxDist) {
      maxDist = dist
      index = i
    }
  }

  if (maxDist <= epsilon) return [first, last]

  const left = simplify(points.slice(0, index + 1), epsilon)
  const right = simplify(points.slice(index), epsilon)
  return [...left.slice(0, -1), ...right]
}

// ─────────────────────────────────────────── the letter box
//
// Stroke data is normalised into a *square* 0–1 box, because a letter has a
// fixed aspect ratio. Canvases do not: the authoring canvas is square but the
// one in Practice is wide. Scaling x by the canvas width and y by its height
// would stretch the letter to fit, so the guide would no longer sit on the
// ghost and a horizontal tolerance would mean something different from a
// vertical one. Everything therefore maps through the largest square that
// fits, centred.

export interface LetterBox {
  /** Side length in canvas pixels. */
  size: number
  /** Offset of the box within the canvas. */
  ox: number
  oy: number
}

export function letterBox(width: number, height: number): LetterBox {
  const size = Math.min(width, height)
  return { size, ox: (width - size) / 2, oy: (height - size) / 2 }
}

/** Ghost glyph proportions, shared so authoring and practice draw it alike. */
export const GHOST_FONT_RATIO = 0.55
/** Optical centring nudge, as a fraction of the box so it scales. */
export const GHOST_BASELINE_NUDGE = 0.02

export function toCanvas([x, y]: NPoint, box: LetterBox): Point {
  return { x: box.ox + x * box.size, y: box.oy + y * box.size }
}

export function fromCanvas(p: Point, box: LetterBox): Point {
  return { x: (p.x - box.ox) / box.size, y: (p.y - box.oy) / box.size }
}

/** Canvas pixels → the 0–1 box the engine works in, rounded to 3 decimals. */
export function normalisePoints(points: Point[], box: LetterBox): NPoint[] {
  return points.map((p) => {
    const n = fromCanvas(p, box)
    return [Math.round(n.x * 1000) / 1000, Math.round(n.y * 1000) / 1000]
  })
}
