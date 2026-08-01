import confetti from 'canvas-confetti'
import { markItemDone } from '@/lib/progress'

/* Palette matches the sunrise tokens so bursts feel on-brand. */
const COLORS = ['#4c9ee8', '#f59e42', '#f5c542', '#4fc47f', '#ffffff']

/** Small burst for a correct answer. */
export function celebrate() {
  confetti({
    particleCount: 45,
    spread: 65,
    startVelocity: 28,
    origin: { y: 0.7 },
    colors: COLORS,
    disableForReducedMotion: true,
  })
}

/**
 * Records a correct answer and fires the matching celebration:
 * small burst for a newly-done item, big volley when it completes the
 * section, silence when the item was already done.
 */
export function recordAndCelebrate(levelId: number, sectionId: number, itemKey: string) {
  const result = markItemDone(levelId, sectionId, itemKey)
  if (result === 'section-complete') celebrateBig()
  else if (result === 'item-done') celebrate()
}

/** Big two-sided volley for completing a whole section. */
export function celebrateBig() {
  const opts = {
    particleCount: 90,
    spread: 100,
    startVelocity: 42,
    colors: COLORS,
    disableForReducedMotion: true,
  }
  confetti({ ...opts, origin: { x: 0.2, y: 0.7 }, angle: 60 })
  confetti({ ...opts, origin: { x: 0.8, y: 0.7 }, angle: 120 })
}
