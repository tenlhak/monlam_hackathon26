/**
 * Level 1 — Section 2: The 4 vowels combining with root consonants.
 *
 * Frontend-only data: no backend needed.
 * Subset: first 8 consonants × 4 vowels = 32 items.
 */

export interface Section2Item {
  /** Full syllable glyph, e.g. "ཀི" */
  text: string
  /** Combined romanisation, e.g. "ki" */
  roman: string
  /** Human gloss, e.g. "ka + i (gi gu)" */
  gloss: string
  /** Base consonant glyph, e.g. "ཀ" */
  base: string
  /** Base consonant roman, e.g. "ka" */
  baseRoman: string
  /** Unicode vowel diacritic, e.g. "\u0F72" */
  vowelMark: string
  /** Tibetan vowel name, e.g. "gi gu" */
  vowelName: string
  /** Latin vowel label, e.g. "i" */
  vowelLabel: string
}

// First 8 consonants — enough to show all 4 vowels without overwhelming
const SUBSET_CONSONANTS = [
  { text: 'ཀ', roman: 'ka' },
  { text: 'ཁ', roman: 'kha' },
  { text: 'ག', roman: 'ga' },
  { text: 'ང', roman: 'nga' },
  { text: 'ཅ', roman: 'ca' },
  { text: 'ཆ', roman: 'cha' },
  { text: 'ཇ', roman: 'ja' },
  { text: 'ཉ', roman: 'nya' },
] as const

export const S2_VOWELS = [
  { mark: '\u0F72', name: 'gi gu',     label: 'i' },
  { mark: '\u0F74', name: 'zhabs kyu', label: 'u' },
  { mark: '\u0F7A', name: 'greng bu',  label: 'e' },
  { mark: '\u0F7C', name: 'na ro',     label: 'o' },
] as const

/** Strip trailing inherent 'a' and append the vowel: "ka" + "i" → "ki" */
function combineRoman(baseRoman: string, vowelLabel: string): string {
  return baseRoman.endsWith('a')
    ? baseRoman.slice(0, -1) + vowelLabel
    : baseRoman + vowelLabel
}

/**
 * 32 items ordered consonant-first:
 * ཀི ཀུ ཀེ ཀོ | ཁི ཁུ ཁེ ཁོ | …
 */
export const SECTION2_ITEMS: Section2Item[] = SUBSET_CONSONANTS.flatMap((con) =>
  S2_VOWELS.map((vow) => ({
    text: con.text + vow.mark,
    roman: combineRoman(con.roman, vow.label),
    gloss: `${con.roman} + ${vow.label} (${vow.name})`,
    base: con.text,
    baseRoman: con.roman,
    vowelMark: vow.mark,
    vowelName: vow.name,
    vowelLabel: vow.label,
  })),
)

export const SECTION2_META = {
  title: 'Foundations',
  focus: 'The 4 vowels — combining diacritics with root consonants.',
}
