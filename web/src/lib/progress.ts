import { useSyncExternalStore } from 'react'
import { getLevel } from '@/lib/curriculum'

/**
 * Per-learner practice progress, kept client-side.
 *
 * An item counts as done the first time the learner completes it in any drill
 * (a correct answer, a passed trace, a played listen). Section progress is
 * done-items / itemCount from curriculum.ts; level progress averages its
 * available sections. Stored per user id so switching accounts on one browser
 * keeps scores apart.
 */

type ProgressData = Record<string, string[]> // "level.section" -> item keys

const listeners = new Set<() => void>()
let currentUserId: number | null = null
let cache: ProgressData = {}

const storageKey = (userId: number) => `ttutor_progress_${userId}`

function load(userId: number): ProgressData {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) ?? '{}')
  } catch {
    return {}
  }
}

export function setProgressUser(userId: number | null) {
  if (userId === currentUserId) return
  currentUserId = userId
  cache = userId === null ? {} : load(userId)
  listeners.forEach((l) => l())
}

function emit() {
  if (currentUserId !== null) {
    localStorage.setItem(storageKey(currentUserId), JSON.stringify(cache))
  }
  listeners.forEach((l) => l())
}

export type MarkResult = 'already-done' | 'item-done' | 'section-complete'

/** Marks one item done and says what that achieved. */
export function markItemDone(levelId: number, sectionId: number, itemKey: string): MarkResult {
  const key = `${levelId}.${sectionId}`
  const done = cache[key] ?? []
  if (done.includes(itemKey)) return 'already-done'
  cache = { ...cache, [key]: [...done, itemKey] }
  emit()
  const total = getLevel(levelId)?.sections.find((s) => s.id === sectionId)?.itemCount ?? 0
  return total > 0 && cache[key].length >= total ? 'section-complete' : 'item-done'
}

export interface SectionProgress {
  done: number
  total: number
  /** 0–100, clamped — itemCount is approximate for some sections */
  percent: number
  complete: boolean
}

export function getSectionProgress(levelId: number, sectionId: number): SectionProgress {
  const total = getLevel(levelId)?.sections.find((s) => s.id === sectionId)?.itemCount ?? 0
  const done = Math.min(cache[`${levelId}.${sectionId}`]?.length ?? 0, total)
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return { done, total, percent, complete: total > 0 && done >= total }
}

export function getLevelProgress(levelId: number): SectionProgress {
  const sections = (getLevel(levelId)?.sections ?? []).filter((s) => s.available)
  const totals = sections.reduce(
    (acc, s) => {
      const p = getSectionProgress(levelId, s.id)
      return { done: acc.done + p.done, total: acc.total + p.total }
    },
    { done: 0, total: 0 },
  )
  const percent = totals.total === 0 ? 0 : Math.round((totals.done / totals.total) * 100)
  return { ...totals, percent, complete: totals.total > 0 && totals.done >= totals.total }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Re-renders when any progress changes. Returns a version number to depend on. */
export function useProgressVersion(): number {
  return useSyncExternalStore(subscribe, () => JSON.stringify(cache).length)
}

export function useSectionProgress(levelId: number, sectionId: number): SectionProgress {
  useProgressVersion()
  return getSectionProgress(levelId, sectionId)
}

export function useLevelProgress(levelId: number): SectionProgress {
  useProgressVersion()
  return getLevelProgress(levelId)
}
