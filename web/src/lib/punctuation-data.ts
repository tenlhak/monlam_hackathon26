/**
 * Level 1 — Section 4: Punctuation.
 *
 * Two marks only, ་ tsheg and ། shad. They are the two a beginner cannot read
 * without: without the tsheg you cannot tell where one syllable stops, and
 * without the shad you cannot tell where a sentence does.
 *
 * Every phrase below already appears elsewhere in this repo — the tutor's
 * practice content or the syllable-architecture examples — so nothing here is
 * newly authored Tibetan.
 */

export interface PunctuationMark {
  id: 'tsheg' | 'shad'
  glyph: string
  /** Tibetan name of the mark */
  name: string
  roman: string
  /** What it is called in English */
  title: string
  /** One line on what it does */
  role: string
  note: string
}

export const MARKS: PunctuationMark[] = [
  {
    id: 'tsheg',
    glyph: '་',
    name: 'ཚེག',
    roman: 'tsheg',
    title: 'Syllable separator',
    role: 'Marks the end of a syllable, not a word.',
    note: 'A word can be several syllables, so a tsheg does not mean a word has finished. It is the dot you see most often — Tibetan puts one after nearly every syllable, including the last one before a shad.',
  },
  {
    id: 'shad',
    glyph: '།',
    name: 'ཤད',
    roman: 'shad',
    title: 'Sentence end',
    role: 'Closes a sentence or clause — the nearest thing to a full stop.',
    note: 'The syllable directly before a shad drops its tsheg, which is why བཀྲ་ཤིས་བདེ་ལེགས། ends ལེགས། and not ལེགས་།',
  },
]

export interface PunctuatedPhrase {
  text: string
  roman: string
  gloss: string
}

/** Sourced from the tutor's own practice content — see t_tutor/tutor/content.py. */
export const PHRASES: PunctuatedPhrase[] = [
  { text: 'ཆུ་', roman: 'chu', gloss: 'water' },
  { text: 'ཨ་མ་', roman: 'a ma', gloss: 'mother' },
  { text: 'ཁ་ལག', roman: 'kha lak', gloss: 'food' },
  { text: 'ཐུགས་རྗེ་ཆེ།', roman: 'thuk je che', gloss: 'thank you' },
  { text: 'ག་ལེར་ཕེབས།', roman: 'ka le phe', gloss: 'goodbye (to one leaving)' },
  { text: 'ཧ་གོ་སོང་།', roman: 'ha ko song', gloss: 'I understand' },
  { text: 'ཧ་གོ་མ་སོང་།', roman: 'ha ko ma song', gloss: "I don't understand" },
  { text: 'བཀྲ་ཤིས་བདེ་ལེགས།', roman: 'tashi delek', gloss: 'hello / greetings' },
]

const TSHEG = '་'
const SHAD_MARKS = '།༎༏༐༑'

/**
 * Split a phrase into its syllables.
 *
 * Counting tsheg alone undercounts, because the final syllable before a shad
 * has none — and ཁ་ལག has no trailing tsheg at all. Stripping the shad marks
 * first and then splitting gives the true count in both cases.
 */
export function splitSyllables(text: string): string[] {
  const withoutShad = [...text]
    .filter((char) => !SHAD_MARKS.includes(char))
    .join('')
  return withoutShad.split(TSHEG).filter((part) => part.length > 0)
}

export function isTsheg(char: string): boolean {
  return char === TSHEG
}

export function isShad(char: string): boolean {
  return SHAD_MARKS.includes(char)
}

export const SECTION4_META = {
  title: 'Punctuation',
  focus: 'ཚེག separates syllables · ཤད ends sentences.',
}
