import type { LevelTone } from '@/lib/curriculum'

/**
 * Per-level accent, shared by the practice picker and the placement result.
 * `tint` backs number badges, chips and level cards; `title` colours headings.
 * Bright, saturated tints to match the playful sky/sunrise palette.
 */
export const LEVEL_TONE: Record<LevelTone, { tint: string; title: string }> = {
  indigo: {
    tint: 'bg-[oklch(0.92_0.05_245)] text-[oklch(0.45_0.15_245)] dark:bg-[oklch(0.34_0.08_245)] dark:text-[oklch(0.84_0.1_240)]',
    title: 'text-[oklch(0.5_0.16_245)] dark:text-[oklch(0.78_0.12_240)]',
  },
  green: {
    tint: 'bg-[oklch(0.93_0.06_150)] text-[oklch(0.42_0.13_150)] dark:bg-[oklch(0.33_0.07_150)] dark:text-[oklch(0.84_0.12_150)]',
    title: 'text-[oklch(0.47_0.14_150)] dark:text-[oklch(0.78_0.13_150)]',
  },
  amber: {
    tint: 'bg-[oklch(0.93_0.06_70)] text-[oklch(0.5_0.13_55)] dark:bg-[oklch(0.35_0.07_60)] dark:text-[oklch(0.85_0.11_70)]',
    title: 'text-[oklch(0.55_0.15_55)] dark:text-[oklch(0.8_0.12_70)]',
  },
  violet: {
    tint: 'bg-[oklch(0.92_0.05_300)] text-[oklch(0.46_0.15_300)] dark:bg-[oklch(0.34_0.08_300)] dark:text-[oklch(0.84_0.1_300)]',
    title: 'text-[oklch(0.5_0.17_300)] dark:text-[oklch(0.79_0.12_300)]',
  },
}
