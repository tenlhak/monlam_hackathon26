import type { LevelTone } from '@/lib/curriculum'

/**
 * Per-level accent, shared by the practice picker and the placement result.
 * `tint` backs number badges, chips and level cards; `title` colours headings.
 */
export const LEVEL_TONE: Record<LevelTone, { tint: string; title: string }> = {
  indigo: {
    tint: 'bg-[oklch(0.94_0.03_275)] text-[oklch(0.42_0.14_275)] dark:bg-[oklch(0.3_0.06_275)] dark:text-[oklch(0.83_0.11_275)]',
    title: 'text-[oklch(0.45_0.16_275)] dark:text-[oklch(0.78_0.12_275)]',
  },
  green: {
    tint: 'bg-[oklch(0.93_0.04_155)] text-[oklch(0.4_0.1_155)] dark:bg-[oklch(0.29_0.05_155)] dark:text-[oklch(0.82_0.1_155)]',
    title: 'text-[oklch(0.42_0.11_155)] dark:text-[oklch(0.77_0.11_155)]',
  },
  amber: {
    tint: 'bg-[oklch(0.94_0.04_75)] text-[oklch(0.44_0.09_60)] dark:bg-[oklch(0.3_0.05_70)] dark:text-[oklch(0.84_0.09_75)]',
    title: 'text-[oklch(0.45_0.1_60)] dark:text-[oklch(0.79_0.1_75)]',
  },
  violet: {
    tint: 'bg-[oklch(0.94_0.035_300)] text-[oklch(0.43_0.14_300)] dark:bg-[oklch(0.3_0.06_300)] dark:text-[oklch(0.83_0.11_300)]',
    title: 'text-[oklch(0.46_0.16_300)] dark:text-[oklch(0.79_0.12_300)]',
  },
}
