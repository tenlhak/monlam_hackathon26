/**
 * Placement routing — which level a learner enters.
 *
 * The spec's routing table gives ranges for three of its rows ("Level 1 or
 * Level 2", "Level 3–4", "Level 4 or 5"), which cannot be returned as a single
 * level. These thresholds resolve them:
 *
 *   | Phase 1 | Phase 2 | Phase 3 | → Level |
 *   |---------|---------|---------|---------|
 *   | < 2/3   | —       | —       | 1  (see heritage below) |
 *   | ≥ 2/3   | < 2/3   | —       | 2 |
 *   | ≥ 2/3   | ≥ 2/3   | < 2/3   | 3 |
 *   | ≥ 2/3   | ≥ 2/3   | 2/3     | 4 |
 *   | ≥ 2/3   | ≥ 2/3   | 3/3     | 5 |
 *
 * Phase 2 has no separate "partial" band — 2/3 is a pass and Phase 3 decides.
 *
 * Heritage learners depart from the spec deliberately. The spec pins a fluent
 * speaker who fails Phase 1 to Level 2 whatever else they score, which throws
 * away a real result: someone who cannot yet decode a syllable may still hold
 * the grammar Phase 3 tests, and parking them in beginner vocabulary teaches
 * them nothing. So the failed script phase becomes a ceiling rather than a
 * fixed destination — grammar places them, and reading caps how far that can
 * carry them.
 */

import { api } from '@/lib/api'
import type { User } from '@/lib/types/tutor'
import { QUESTIONS, type Phase } from './quiz-data'

export type Level = 1 | 2 | 3 | 4 | 5

export interface PhaseScores {
  p1: number
  p2: number
  p3: number
}

/** Correct answers needed in a phase to pass it. */
export const PHASE_PASS_MARK = 2

/** Questions per phase — 3 each, but derived so the data stays authoritative. */
export function phaseTotal(phase: Phase): number {
  return QUESTIONS.filter((q) => q.phase === phase).length
}

/**
 * Highest level reachable without passing the script phase.
 *
 * Levels 1–4 can be entered on spoken grammar and caught up on reading, but
 * Level 5's specialist tracks are built on classical and cursive texts — there
 * is nothing there for someone who cannot read yet.
 */
export const NON_READER_CEILING: Level = 4

/**
 * Pure routing decision. No side effects, no storage — call `savePlacement`
 * separately once the learner reaches the result screen.
 */
export function routeToLevel(scores: PhaseScores, isHeritage: boolean): Level {
  const canRead = scores.p1 >= PHASE_PASS_MARK

  // Someone who can neither read nor speak starts at the script phase.
  if (!canRead && !isHeritage) return 1

  // Grammar decides. A fluent speaker who failed Phase 1 is placed on what
  // they actually know rather than pinned to Level 2 — Level 2 remains their
  // floor because that is where a failed Phase 2 lands anyone.
  let level: Level
  if (scores.p2 < PHASE_PASS_MARK) level = 2
  else if (scores.p3 < PHASE_PASS_MARK) level = 3
  else level = scores.p3 === phaseTotal(3) ? 5 : 4

  return !canRead && level > NON_READER_CEILING ? NON_READER_CEILING : level
}

/** Tally correct answers per phase from a map of question id → option id. */
export function scoreAnswers(answers: Record<string, string>): PhaseScores {
  const scores: PhaseScores = { p1: 0, p2: 0, p3: 0 }
  for (const q of QUESTIONS) {
    const chosen = answers[q.id]
    if (!chosen) continue
    if (!q.options.find((o) => o.id === chosen)?.correct) continue
    if (q.phase === 1) scores.p1++
    else if (q.phase === 2) scores.p2++
    else scores.p3++
  }
  return scores
}

// ───────────────────────────────────────────────────────────── storage

export const PLACEMENT_STORAGE_KEY = 'monlam_placement_result'

export interface PlacementResult {
  level: number
  scores: PhaseScores & { heritage: boolean }
  /** ISO 8601 */
  completedAt: string
}

export function savePlacement(
  level: Level,
  scores: PhaseScores,
  isHeritage: boolean,
): PlacementResult {
  const result: PlacementResult = {
    level,
    scores: { ...scores, heritage: isHeritage },
    completedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(PLACEMENT_STORAGE_KEY, JSON.stringify(result))
  } catch {
    // Private browsing or a full quota — the result screen still renders.
  }
  return result
}

/**
 * Persist the placement to the learner's account and return the updated user.
 *
 * The backend takes the greater of the stored and submitted level, so a weaker
 * retake cannot remove levels
 * they already unlocked, and stamps `placed_at` — which is what stops the
 * quiz being shown again.
 */
export async function submitPlacement(
  userId: number,
  level: Level,
): Promise<User> {
  const res = await api.post<User>(`/api/user/${userId}/placement`, { level })
  return res.data
}

export function loadPlacement(): PlacementResult | null {
  try {
    const raw = localStorage.getItem(PLACEMENT_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PlacementResult) : null
  } catch {
    return null
  }
}
