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

/**
 * The Tibetan face, matching --font-tibetan in index.css.
 *
 * Canvas cannot read a CSS custom property, so this is the one place the two
 * are kept in step. Change the font in index.css and change it here.
 */
export const TIBETAN_FONT = '"Monlam TBslim", serif'

/**
 * Fallback ghost proportions, used only for glyphs with no authored strokes.
 *
 * Anything authored is positioned by fitting instead — see fitGlyphInto. These
 * constants were calibrated by eye against Noto Serif Tibetan, and the fact
 * that swapping to Monlam moved the ghost off the guides is exactly why they
 * are no longer trusted for letters we have real data for.
 */
export const GHOST_FONT_RATIO = 0.55
export const GHOST_BASELINE_NUDGE = 0.02

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

/**
 * How far the ghost is grown beyond the strokes it is fitted to, in normalised
 * units — *not* as a fraction of the letter.
 *
 * Authored strokes are centrelines, so the glyph's ink extends past them by
 * about half a stroke width. That distance is a property of the pen, roughly
 * the same for every letter, so expressing it as a fraction of the bounding box
 * gets it wrong at both ends: ཀ spans 0.22 to 0.83 because of its descender, so
 * a 16% top allowance lifted the ghost by three head-bar thicknesses, while a
 * short letter like ང would barely have been nudged.
 *
 * The top is still the largest, because the head line is a thick bar whose
 * centreline sits below the top of the ink, whereas a descender tapers to
 * almost nothing at the point its centreline ends.
 */
export const GHOST_FIT_PAD: Insets = { top: 0.025, right: 0.02, bottom: 0.01, left: 0.02 }

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Bounding box of a set of authored strokes, in normalised 0–1 units. */
export function strokeBounds(strokes: AuthoredStroke[]): Rect | null {
  const points = strokes.flatMap((s) => s.points)
  if (points.length === 0) return null

  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY }
}

/**
 * Grow a rect outwards by absolute insets, scaled by `unit`.
 *
 * `unit` is 1 when the rect is in normalised coordinates, or the letter box
 * size when it is in canvas pixels.
 */
export function padRect(r: Rect, pad: Insets, unit = 1): Rect {
  const left = pad.left * unit
  const right = pad.right * unit
  const top = pad.top * unit
  const bottom = pad.bottom * unit
  return {
    x: r.x - left,
    y: r.y - top,
    w: r.w + left + right,
    h: r.h + top + bottom,
  }
}

/**
 * Draw a glyph scaled and positioned so its *ink* fills the given rect.
 *
 * Font size alone cannot place a glyph predictably: two faces at the same size
 * put their ink in different places within the em box, which is what moved the
 * ghost off the guides when the app changed font. Measuring the ink and fitting
 * it to a rect derived from the strokes themselves makes the result identical
 * whatever face is loaded.
 *
 * Returns false when the glyph could not be measured, so the caller can fall
 * back — this happens if the font has not finished loading.
 */
export function fitGlyphInto(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  target: Rect,
  weight = 200,
): boolean {
  const PROBE = 200
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  const measure = (size: number) => {
    ctx.font = `${weight} ${size}px ${TIBETAN_FONT}`
    const m = ctx.measureText(glyph)
    return {
      left: m.actualBoundingBoxLeft,
      ascent: m.actualBoundingBoxAscent,
      w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
      h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
    }
  }

  const probe = measure(PROBE)
  if (!(probe.w > 0) || !(probe.h > 0)) return false

  // Uniform scale: the letter must not be stretched to fill the rect.
  const size = PROBE * Math.min(target.w / probe.w, target.h / probe.h)
  const ink = measure(size)

  // fillText positions by baseline and alignment point, so shift such that the
  // ink box lands where we want it. Horizontally the glyph is centred in any
  // slack; vertically it is anchored to the top, because the head line is the
  // one landmark every letter shares and centring would let a letter with a
  // long descender drift away from it.
  const x = target.x + (target.w - ink.w) / 2 + ink.left
  const y = target.y + ink.ascent
  ctx.fillText(glyph, x, y)
  return true
}

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
