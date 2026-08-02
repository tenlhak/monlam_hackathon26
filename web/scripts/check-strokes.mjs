/**
 * Validate authored stroke data against the grader.
 *
 *   npm run check:strokes
 *
 * Run this after authoring each row. It catches the mistakes that are easy to
 * make while tracing and hard to see afterwards: a stroke that duplicates
 * another, a stroke short enough that a different one passes in its place, a
 * letter whose reference cannot be traced back to itself.
 *
 * Loads the real modules through Vite so aliases and JSON imports resolve
 * exactly as they do in the app.
 */

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createServer } from 'vite'

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const server = await createServer({
  root: WEB,
  configFile: resolve(WEB, 'vite.config.ts'),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

const { TOLERANCES, gradeStroke, strokesFor, toPoints, resample } =
  await server.ssrLoadModule('/src/lib/stroke-grader.ts')
const { AUTHOR_TARGETS } = await server.ssrLoadModule('/src/lib/stroke-data.ts')

const tol = TOLERANCES.guided
const authored = AUTHOR_TARGETS.filter((t) => strokesFor(t.glyph))

let failures = 0
const check = (label, ok, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ${label}${detail ? '  — ' + detail : ''}`)
}

console.log(`\nAuthored ${authored.length} of ${AUTHOR_TARGETS.length}: ${authored.map((t) => t.glyph).join(' ')}`)
const missing = AUTHOR_TARGETS.filter((t) => !strokesFor(t.glyph))
if (missing.length) console.log(`Remaining: ${missing.map((t) => t.glyph).join(' ')}`)

console.log('\n1. Reference traces back to itself')
for (const { glyph } of authored) {
  const ref = strokesFor(glyph)
  let worst = 0
  const ok = ref.strokes.every((s) => {
    const v = gradeStroke(toPoints(s.points), s, tol)
    worst = Math.max(worst, v.deviation)
    return v.ok
  })
  check(`${glyph} ${ref.strokes.length} strokes`, ok, `worst deviation ${worst.toFixed(4)}`)
}

console.log('\n2. Reversed strokes are caught as direction errors')
for (const { glyph } of authored) {
  const ref = strokesFor(glyph)
  const wrong = ref.strokes.filter(
    (s) => gradeStroke([...toPoints(s.points)].reverse(), s, tol).issue !== 'direction',
  )
  check(`${glyph}`, wrong.length === 0, wrong.length ? `${wrong.length} not caught` : '')
}

console.log('\n3. No stroke passes as another stroke of the same letter')
for (const { glyph } of authored) {
  const ref = strokesFor(glyph)
  const clashes = []
  ref.strokes.forEach((a, i) =>
    ref.strokes.forEach((b, j) => {
      if (i !== j && gradeStroke(toPoints(a.points), b, tol).ok) clashes.push(`${i + 1}→${j + 1}`)
    }),
  )
  check(`${glyph}`, clashes.length === 0, clashes.join(', '))
}

console.log('\n4. Incomplete strokes are rejected (55% by arc length)')
for (const { glyph } of authored) {
  const ref = strokesFor(glyph)
  const passed = ref.strokes.filter((s) =>
    gradeStroke(resample(toPoints(s.points), 64).slice(0, 35), s, tol).ok,
  ).length
  check(`${glyph}`, passed === 0, passed ? `${passed} accepted` : '')
}

// Everything above tests whether the data is internally consistent. A letter
// traced only half way is perfectly consistent, so it passes all of it — the
// checks below ask instead whether a letter looks finished, by comparing it
// against the shape of the letters already authored.
console.log('\n5. Letters look complete')
{
  const extents = authored.map(({ glyph }) => {
    const pts = strokesFor(glyph).strokes.flatMap((s) => s.points)
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    return {
      glyph,
      strokes: strokesFor(glyph).strokes.length,
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    }
  })

  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

  // A vowel sign is a diacritic: legitimately a fraction of a consonant's size
  // and sometimes a single stroke. Comparing it against the consonants would
  // fail all four of them for being exactly what they are, so each group is
  // measured against its own kind.
  const isVowel = (glyph) => AUTHOR_TARGETS.some((t) => t.glyph === glyph && t.base)

  for (const vowels of [false, true]) {
    const group = extents.filter((e) => isVowel(e.glyph) === vowels)
    if (group.length === 0) continue

    const mw = median(group.map((e) => e.w))
    const mh = median(group.map((e) => e.h))
    const minStrokes = vowels ? 1 : 2

    for (const e of group) {
      const reasons = []
      if (e.strokes < minStrokes) reasons.push(`only ${e.strokes} stroke`)

      // Small in *both* directions means a letter that was never finished.
      // Small in one direction alone is just a letter's shape: ཝ is compact so
      // it is half the height of its neighbours while being full width, and
      // flagging that penalised it for being drawn correctly.
      const narrow = e.w < mw * 0.55
      const short = e.h < mh * 0.55
      if (narrow && short) {
        reasons.push(`${e.w.toFixed(2)}x${e.h.toFixed(2)} vs median ${mw.toFixed(2)}x${mh.toFixed(2)}`)
      } else if (e.w < 0.05 || e.h < 0.05) {
        reasons.push(`collapsed to ${e.w.toFixed(2)}x${e.h.toFixed(2)}`)
      }

      check(`${e.glyph}`, reasons.length === 0, reasons.join('; '))
    }
  }
}

console.log('\n6. Degenerate input is rejected')
{
  const s = strokesFor(authored[0].glyph).strokes[0]
  check('single point', gradeStroke([{ x: 0.4, y: 0.2 }], s, tol).issue === 'too-short')
  check('tiny flick', gradeStroke([{ x: 0.4, y: 0.2 }, { x: 0.41, y: 0.2 }], s, tol).issue === 'too-short')
}

// ── measurements, not verdicts ──────────────────────────────────────
// These are the numbers to revisit once real learners (not the person who
// authored the reference) have traced a few letters.

console.log('\nMeasurements — leniency, to calibrate against real attempts')

let maxOvershoot = 0
for (const { glyph } of authored) {
  for (const s of strokesFor(glyph).strokes) {
    const d = resample(toPoints(s.points), 64)
    for (let extra = 0; extra <= 40; extra++) {
      const last = d[63], prev = d[62]
      const ext = Array.from({ length: extra }, (_, k) => ({
        x: last.x + (last.x - prev.x) * (k + 1),
        y: last.y + (last.y - prev.y) * (k + 1),
      }))
      if (!gradeStroke([...d, ...ext], s, tol).ok) break
      maxOvershoot = Math.max(maxOvershoot, (63 + extra) / 63)
    }
  }
}
console.log(`  overshoot accepted up to ${maxOvershoot.toFixed(2)}x the reference length`)

for (const amp of [0.02, 0.04, 0.06, 0.08]) {
  let ok = 0, total = 0
  for (const { glyph } of authored) {
    strokesFor(glyph).strokes.forEach((s, i) => {
      total++
      const j = toPoints(s.points).map((p, k) => ({
        x: p.x + Math.sin(k * 2.7 + i) * amp,
        y: p.y + Math.cos(k * 1.9 + i) * amp,
      }))
      if (gradeStroke(j, s, tol).ok) ok++
    })
  }
  console.log(`  wobble ±${amp}: ${ok}/${total} strokes still accepted`)
}

console.log(failures === 0 ? '\n\x1b[32mAll checks passed.\x1b[0m\n' : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`)
await server.close()
process.exit(failures === 0 ? 0 : 1)
