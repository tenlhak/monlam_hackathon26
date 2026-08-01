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

/** Stroke names that recur across the alphabet, offered as autocomplete. */
export const STROKE_NAMES = [
  { bo: 'མགོ', latin: 'go — head line' },
  { bo: 'མཆེ་བ', latin: 'che ba — fang' },
  { bo: 'དབུས་ཡིག', latin: 'ü yig — centre stroke' },
  { bo: 'ཀང་', latin: 'kang — leg' },
  { bo: 'ཞབས་ཀྱུ', latin: 'zhabs kyu — foot hook' },
  { bo: 'མགོ་ཡིག', latin: 'go yig — upper stroke' },
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

/** Canvas pixels → the 0–1 box the engine works in, rounded to 3 decimals. */
export function normalisePoints(points: Point[], width: number, height: number): NPoint[] {
  return points.map((p) => [
    Math.round((p.x / width) * 1000) / 1000,
    Math.round((p.y / height) * 1000) / 1000,
  ])
}
