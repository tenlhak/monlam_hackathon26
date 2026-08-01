/**
 * Grading a traced letter against its authored stroke order.
 *
 * The point of this file is that it can see things an ink-overlap score cannot:
 * whether the strokes were made in the traditional order, and whether each one
 * was drawn in the right direction. A learner who draws ཀ bottom-up in one
 * continuous scribble produces almost the same ink as one who writes it
 * correctly, and the old coverage check passed both.
 *
 * Everything here works in the same normalised 0–1 box the authored data uses,
 * so grading is independent of canvas size, and it is pure — no React, no
 * network, no canvas. That keeps it instant and testable.
 */

import type { AuthoredGlyph, AuthoredStroke, NPoint } from '@/lib/stroke-data'
import STROKE_DATA from '@/data/strokes.json'

export interface P {
  x: number
  y: number
}

/** Why a stroke was rejected. Each maps to a different thing to say. */
export type StrokeIssue = 'too-short' | 'direction' | 'start' | 'shape' | 'length'

export interface StrokeVerdict {
  ok: boolean
  issue?: StrokeIssue
  /** Mean distance from the reference path, in 0–1 units. Lower is better. */
  deviation: number
}

export interface Tolerance {
  /** How far from the reference's first point the learner may begin. */
  start: number
  /** Mean allowed distance from the reference path. */
  deviation: number
}

/**
 * Guided tracing shows the learner exactly where to go, so it can afford to be
 * strict; free recall from a blank box cannot. These are starting values —
 * they need re-tuning against attempts by someone other than whoever authored
 * the reference, because the author's own hand will always score near-perfect
 * against their own strokes.
 */
export const TOLERANCES: Record<'guided' | 'outline' | 'free', Tolerance> = {
  guided: { start: 0.20, deviation: 0.15 },
  outline: { start: 0.24, deviation: 0.18 },
  free: { start: 0.30, deviation: 0.22 },
}

/** Points compared after both paths are reduced to this many samples. */
const SAMPLES = 32

/**
 * Tolerances are also capped relative to the length of the stroke being drawn.
 *
 * A flat allowance in the 0–1 box is meaningless for a short stroke: ཉ's head
 * line is 0.164 long, so an absolute 0.15 of slack is nearly the whole stroke,
 * and its second stroke — a short descender starting at the same point — fell
 * inside that and was accepted in the head line's place. Scaling by length
 * keeps the allowance proportionate to what is actually being asked for.
 */
const DEVIATION_RATIO = 0.35
const START_RATIO = 0.6

/** Floors, so a very short stroke does not become impossible to satisfy. */
const MIN_DEVIATION = 0.04
const MIN_START = 0.06

/**
 * How much shorter or longer than the reference a stroke may be.
 *
 * Deviation alone cannot catch a stroke that is merely *incomplete*: ཅ's
 * fourth stroke runs along the same diagonal as its third, in the same
 * direction, at under half the length, and was accepted in its place. Stopping
 * half way through a stroke is also a real thing learners do, and it deserves
 * its own correction rather than a vague "follow it more closely".
 */
const MIN_LENGTH_RATIO = 0.6
const MAX_LENGTH_RATIO = 1.8

// ───────────────────────────────────────────────────────── data access

const BY_GLYPH = new Map<string, AuthoredGlyph>(
  (STROKE_DATA as AuthoredGlyph[]).map((g) => [g.glyph, g]),
)

/** The authored strokes for a glyph, or null if it has not been authored yet. */
export function strokesFor(glyph: string): AuthoredGlyph | null {
  return BY_GLYPH.get(glyph) ?? null
}

export function hasStrokeData(glyph: string): boolean {
  return BY_GLYPH.has(glyph)
}

// ───────────────────────────────────────────────────────── geometry

export function toPoints(points: NPoint[]): P[] {
  return points.map(([x, y]) => ({ x, y }))
}

/** Canvas pixels → the 0–1 box the reference data lives in. */
export function normalise(points: P[], width: number, height: number): P[] {
  return points.map((p) => ({ x: p.x / width, y: p.y / height }))
}

function distance(a: P, b: P): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function pathLength(points: P[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i])
  return total
}

/**
 * Resample a path to `n` points evenly spaced along its length.
 *
 * Without this, comparison would be dominated by drawing speed: a learner who
 * pauses mid-stroke emits a cluster of points there, and a naive point-by-point
 * comparison would read that cluster as a shape difference.
 */
export function resample(points: P[], n = SAMPLES): P[] {
  if (points.length === 0) return []
  if (points.length === 1) return Array.from({ length: n }, () => points[0])

  const total = pathLength(points)
  if (total === 0) return Array.from({ length: n }, () => points[0])

  const step = total / (n - 1)
  const pts = [...points]
  const out: P[] = [pts[0]]
  let accumulated = 0
  let i = 1

  while (i < pts.length && out.length < n) {
    const segment = distance(pts[i - 1], pts[i])
    if (segment === 0) {
      i++
      continue
    }

    if (accumulated + segment >= step) {
      const t = (step - accumulated) / segment
      const inserted = {
        x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x),
        y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y),
      }
      out.push(inserted)
      // Carry on from the inserted point so the spacing stays even.
      pts.splice(i, 0, inserted)
      i++
      accumulated = 0
    } else {
      accumulated += segment
      i++
    }
  }

  while (out.length < n) out.push(pts[pts.length - 1])
  return out.slice(0, n)
}

function meanDistance(a: P[], b: P[]): number {
  let total = 0
  for (let i = 0; i < a.length; i++) total += distance(a[i], b[i])
  return total / a.length
}

// ───────────────────────────────────────────────────────── grading

/**
 * Grade one learner stroke against one reference stroke.
 *
 * Checks run in the order the corrections should be given: a stroke drawn
 * backwards is reported as backwards, not as "wrong shape", because reversing
 * it is the single thing that would fix it.
 */
export function gradeStroke(
  learner: P[],
  reference: AuthoredStroke,
  tolerance: Tolerance,
): StrokeVerdict {
  const ref = resample(toPoints(reference.points))

  // A tap or a flick carries no path to compare.
  if (learner.length < 2 || pathLength(learner) < 0.04) {
    return { ok: false, issue: 'too-short', deviation: 1 }
  }

  const drawn = resample(learner)
  const forward = meanDistance(drawn, ref)
  const backward = meanDistance(drawn, [...ref].reverse())

  // Short strokes get proportionately less slack than long ones.
  const refLength = pathLength(ref)
  const allowedDeviation = Math.min(
    tolerance.deviation,
    Math.max(MIN_DEVIATION, DEVIATION_RATIO * refLength),
  )
  const allowedStart = Math.min(tolerance.start, Math.max(MIN_START, START_RATIO * refLength))

  // Clearly a better fit reversed: right path, wrong way along it.
  if (backward < forward * 0.75) {
    return { ok: false, issue: 'direction', deviation: forward }
  }

  if (distance(drawn[0], ref[0]) > allowedStart) {
    return { ok: false, issue: 'start', deviation: forward }
  }

  const ratio = pathLength(learner) / refLength
  if (ratio < MIN_LENGTH_RATIO || ratio > MAX_LENGTH_RATIO) {
    return { ok: false, issue: 'length', deviation: forward }
  }

  if (forward > allowedDeviation) {
    return { ok: false, issue: 'shape', deviation: forward }
  }

  return { ok: true, deviation: forward }
}

/** What to tell the learner, in terms of the stroke's own Tibetan name. */
export function feedbackFor(
  issue: StrokeIssue,
  reference: AuthoredStroke,
  strokeNumber: number,
): string {
  const name = reference.name ? `the ${reference.name}` : `stroke ${strokeNumber}`

  switch (issue) {
    case 'too-short':
      return `Draw ${name} as one continuous stroke.`
    case 'direction':
      return `Right path, wrong way — ${name} is drawn the other direction.`
    case 'start':
      return `Begin ${name} at the marked starting point.`
    case 'length':
      return `Draw ${name} all the way — that is only part of it.`
    case 'shape':
      return `Follow ${name} more closely, then try again.`
  }
}
