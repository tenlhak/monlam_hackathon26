/** Simple geometry check: stroke coverage over a letter-shaped cell grid. */

export type Point = { x: number; y: number }

const GRID = 8

/** Soft letter mask — denser through the middle, lighter at corners. */
function letterMask(col: number, row: number): boolean {
  const cx = (col + 0.5) / GRID
  const cy = (row + 0.5) / GRID
  const dx = cx - 0.5
  const dy = cy - 0.48
  // Vertical stem + upper bowl approximation
  const stem = Math.abs(dx) < 0.18 && cy > 0.22 && cy < 0.92
  const bowl = dx * dx + (dy + 0.08) * (dy + 0.08) < 0.12 && cy < 0.55
  const top = cy < 0.28 && Math.abs(dx) < 0.32
  return stem || bowl || top
}

export function checkTraceCoverage(
  strokes: Point[][],
  width: number,
  height: number,
): { ok: boolean; coverage: number } {
  if (width <= 0 || height <= 0 || strokes.length === 0) {
    return { ok: false, coverage: 0 }
  }

  const hit = Array.from({ length: GRID }, () => Array(GRID).fill(false))
  let required = 0
  let covered = 0

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (letterMask(c, r)) required++
    }
  }

  for (const stroke of strokes) {
    for (const p of stroke) {
      const c = Math.min(GRID - 1, Math.max(0, Math.floor((p.x / width) * GRID)))
      const r = Math.min(GRID - 1, Math.max(0, Math.floor((p.y / height) * GRID)))
      hit[r][c] = true
    }
  }

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (letterMask(c, r) && hit[r][c]) covered++
    }
  }

  const coverage = required === 0 ? 0 : covered / required
  return { ok: coverage >= 0.45, coverage }
}
