export type Consonant = {
  id: string
  glyph: string
  latin: string
}

export type ConsonantRow = {
  id: string
  label: string
  labelBo: string
  letters: Consonant[]
}

/** Traditional 8 rows (\u0f66\u0fa1\u0f7a\u0f0b\u0f5a\u0f53\u0f0b\u0f56\u0f62\u0f92\u0fb1\u0f51\u0f0d) — 30 consonants. */
export const CONSONANT_ROWS: ConsonantRow[] = [
  {
    id: 'ka',
    label: '\u0f40-row',
    labelBo: '\u0f40\u0f0b\u0f66\u0fa1\u0f7a\u0f0d',
    letters: [
      { id: 'ka', glyph: '\u0f40', latin: 'ka' },
      { id: 'kha', glyph: '\u0f41', latin: 'kha' },
      { id: 'ga', glyph: '\u0f42', latin: 'ga' },
      { id: 'nga', glyph: '\u0f44', latin: 'nga' },
    ],
  },
  {
    id: 'ca',
    label: '\u0f45-row',
    labelBo: '\u0f45\u0f0b\u0f66\u0fa1\u0f7a\u0f0d',
    letters: [
      { id: 'ca', glyph: '\u0f45', latin: 'ca' },
      { id: 'cha', glyph: '\u0f46', latin: 'cha' },
      { id: 'ja', glyph: '\u0f47', latin: 'ja' },
      { id: 'nya', glyph: '\u0f49', latin: 'nya' },
    ],
  },
  {
    id: 'ta',
    label: '\u0f4f-row',
    labelBo: '\u0f4f\u0f0b\u0f66\u0fa1\u0f7a\u0f0d',
    letters: [
      { id: 'ta', glyph: '\u0f4f', latin: 'ta' },
      { id: 'tha', glyph: '\u0f50', latin: 'tha' },
      { id: 'da', glyph: '\u0f51', latin: 'da' },
      { id: 'na', glyph: '\u0f53', latin: 'na' },
    ],
  },
  {
    id: 'pa',
    label: '\u0f54-row',
    labelBo: '\u0f54\u0f0b\u0f66\u0fa1\u0f7a\u0f0d',
    letters: [
      { id: 'pa', glyph: '\u0f54', latin: 'pa' },
      { id: 'pha', glyph: '\u0f55', latin: 'pha' },
      { id: 'ba', glyph: '\u0f56', latin: 'ba' },
      { id: 'ma', glyph: '\u0f58', latin: 'ma' },
    ],
  },
  {
    id: 'tsa',
    label: '\u0f59-row',
    labelBo: '\u0f59\u0f0b\u0f66\u0fa1\u0f7a\u0f0d',
    letters: [
      { id: 'tsa', glyph: '\u0f59', latin: 'tsa' },
      { id: 'tsha', glyph: '\u0f5a', latin: 'tsha' },
      { id: 'dza', glyph: '\u0f5b', latin: 'dza' },
      { id: 'wa', glyph: '\u0f5d', latin: 'wa' },
    ],
  },
  {
    id: 'zha',
    label: '\u0f5e-row',
    labelBo: '\u0f5e\u0f0b\u0f66\u0fa1\u0f7a\u0f0d',
    letters: [
      { id: 'zha', glyph: '\u0f5e', latin: 'zha' },
      { id: 'za', glyph: '\u0f5f', latin: 'za' },
      { id: 'a', glyph: '\u0f60', latin: '\'a' },
      { id: 'ya', glyph: '\u0f61', latin: 'ya' },
    ],
  },
  {
    id: 'ra',
    label: '\u0f62-row',
    labelBo: '\u0f62\u0f0b\u0f66\u0fa1\u0f7a\u0f0d',
    letters: [
      { id: 'ra', glyph: '\u0f62', latin: 'ra' },
      { id: 'la', glyph: '\u0f63', latin: 'la' },
      { id: 'sha', glyph: '\u0f64', latin: 'sha' },
      { id: 'sa', glyph: '\u0f66', latin: 'sa' },
    ],
  },
  {
    id: 'ha',
    label: '\u0f67-row',
    labelBo: '\u0f67\u0f0b\u0f66\u0fa1\u0f7a\u0f0d',
    letters: [
      { id: 'ha', glyph: '\u0f67', latin: 'ha' },
      { id: 'a-chen', glyph: '\u0f68', latin: 'a' },
    ],
  },
]

export const ALL_CONSONANTS = CONSONANT_ROWS.flatMap((row) => row.letters)

export type LessonStage = 'listen' | 'trace' | 'speak' | 'quiz'

export const LESSON_STAGES: { id: LessonStage; label: string }[] = [
  { id: 'listen', label: 'Listen' },
  { id: 'trace', label: 'Trace' },
  { id: 'speak', label: 'Speak' },
  { id: 'quiz', label: 'Quiz' },
]
