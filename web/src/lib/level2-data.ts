/**
 * Stage 2 — Functional beginner. Frontend-only drill content.
 *
 * Covers the three sections whose items were specified exactly:
 *   2.2 question forms · 2.3 verb basics · 2.4 numbers in speech
 *
 * Register matters here in a way it did not in Stage 1. Several of the
 * question words are literary forms a learner will read but never hear, so
 * each one carries its spoken Lhasa equivalent and drills render whichever
 * register the exercise is set in.
 *
 * NOTE: the Tibetan below is curated, not generated, but it has not been
 * reviewed by a native speaker. Verify before this ships to learners.
 */

// ─────────────────────────────────────────────── 2.2 Question forms

export type Register = 'literary' | 'spoken'

export interface QuestionWord {
  id: string
  /** Literary form — the one taught in grammar */
  text: string
  roman: string
  en: string
  /** Spoken Lhasa equivalent, when it differs from the literary form */
  spoken?: string
  spokenRoman?: string
}

export const QUESTION_WORDS: QuestionWord[] = [
  { id: 'gare', text: 'ག་རེ', roman: 'ka re', en: 'what' },
  { id: 'su', text: 'སུ', roman: 'su', en: 'who' },
  {
    id: 'gangdu',
    text: 'གང་དུ',
    roman: 'kang du',
    en: 'where',
    spoken: 'ག་པར',
    spokenRoman: 'ka par',
  },
  {
    id: 'nam',
    text: 'ནམ',
    roman: 'nam',
    en: 'when',
    spoken: 'ག་དུས',
    spokenRoman: 'ka dü',
  },
  {
    id: 'cichir',
    text: 'ཅི་ཕྱིར',
    roman: 'chi chir',
    en: 'why',
    spoken: 'ག་རེ་བྱས་ནས',
    spokenRoman: 'ka re che nä',
  },
  {
    id: 'jitar',
    text: 'ཇི་ལྟར',
    roman: 'ji tar',
    en: 'how',
    spoken: 'ག་འདྲས',
    spokenRoman: 'ka drä',
  },
]

/** The form actually used in a given register. */
export function formFor(word: QuestionWord, register: Register): string {
  return register === 'spoken' ? (word.spoken ?? word.text) : word.text
}

export function romanFor(word: QuestionWord, register: Register): string {
  return register === 'spoken' ? (word.spokenRoman ?? word.roman) : word.roman
}

export interface GapItem {
  id: string
  /** Text before the blank */
  before: string
  /** Text after the blank */
  after: string
  /** id of the QuestionWord that fills the gap */
  answerId: string
  /** Register the sentence is written in — drives which form the choices show */
  register: Register
  en: string
}

export const QUESTION_GAPS: GapItem[] = [
  {
    id: 'g1',
    before: 'ཁྱེད་རང་གི་མིང་ལ་',
    after: '་ཟེར་གྱི་ཡོད།',
    answerId: 'gare',
    register: 'spoken',
    en: 'What is your name?',
  },
  {
    id: 'g2',
    before: 'ཁོང་',
    after: '་རེད།',
    answerId: 'su',
    register: 'spoken',
    en: 'Who is that?',
  },
  {
    id: 'g3',
    before: 'ཁྱེད་རང་',
    after: '་ཕེབས་ཀྱི་ཡིན།',
    answerId: 'gangdu',
    register: 'spoken',
    en: 'Where are you going?',
  },
  {
    id: 'g4',
    before: 'ལས་ཀ་',
    after: '་འགོ་ཚུགས་ཀྱི་རེད།',
    answerId: 'nam',
    register: 'spoken',
    en: 'When does work start?',
  },
  {
    id: 'g5',
    before: '',
    after: '་ཡོང་མ་སོང་།',
    answerId: 'cichir',
    register: 'spoken',
    en: 'Why did you not come?',
  },
  {
    id: 'g6',
    before: 'འདི་',
    after: '་བྱེད་དགོས་རེད།',
    answerId: 'jitar',
    register: 'spoken',
    en: 'How should this be done?',
  },
]

// ───────────────────────────────────────────────── 2.3 Verb basics

export interface Verb {
  id: string
  en: string
  present: string
  presentRoman: string
  past: string
  pastRoman: string
  /** Present and past are the same written form — very common in speech */
  collapsed: boolean
  /** Past is not formed by regular affixation */
  irregular: boolean
  note?: string
}

export const VERBS: Verb[] = [
  {
    id: 'dro',
    en: 'go',
    present: 'འགྲོ',
    presentRoman: 'dro',
    past: 'ཕྱིན',
    pastRoman: 'chin',
    collapsed: false,
    irregular: true,
    note: 'Suppletive — the past stem shares no letters with the present. In speech the past is usually སོང (song).',
  },
  {
    id: 'ong',
    en: 'come',
    present: 'འོང',
    presentRoman: 'ong',
    past: 'འོངས',
    pastRoman: 'ongs',
    collapsed: false,
    irregular: false,
    note: 'Spoken Lhasa says ཡོང (yong); for arriving somewhere, སླེབས (leb) is more common.',
  },
  {
    id: 'za',
    en: 'eat',
    present: 'ཟ',
    presentRoman: 'sa',
    past: 'བཟས',
    pastRoman: 'sä',
    collapsed: false,
    irregular: false,
  },
  {
    id: 'thung',
    en: 'drink',
    present: 'འཐུང',
    presentRoman: 'thung',
    past: 'འཐུངས',
    pastRoman: 'thungs',
    collapsed: false,
    irregular: false,
  },
  {
    id: 'ta',
    en: 'look',
    present: 'བལྟ',
    presentRoman: 'ta',
    past: 'བལྟས',
    pastRoman: 'tä',
    collapsed: false,
    irregular: false,
  },
  {
    id: 'thoe',
    en: 'hear',
    present: 'ཐོས',
    presentRoman: 'thö',
    past: 'ཐོས',
    pastRoman: 'thö',
    collapsed: true,
    irregular: false,
    note: 'Collapsed — one written form covers both stems. Tense comes from the auxiliary, not the verb.',
  },
  {
    id: 'she',
    en: 'know',
    present: 'ཤེས',
    presentRoman: 'shé',
    past: 'ཤེས',
    pastRoman: 'shé',
    collapsed: true,
    irregular: false,
    note: 'Collapsed — one written form covers both stems.',
  },
]

// ─────────────────────────────────────────── 2.4 Numbers in speech

export interface Numeral {
  /** Arabic value */
  value: number
  /** Tibetan digit glyph, e.g. ༧ — only defined for 0–9 */
  digits: string
  /** Spelled-out Tibetan word */
  word: string
  roman: string
}

export const DIGITS: Numeral[] = [
  { value: 0, digits: '༠', word: 'ཀླད་ཀོར', roman: 'le kor' },
  { value: 1, digits: '༡', word: 'གཅིག', roman: 'chik' },
  { value: 2, digits: '༢', word: 'གཉིས', roman: 'nyi' },
  { value: 3, digits: '༣', word: 'གསུམ', roman: 'sum' },
  { value: 4, digits: '༤', word: 'བཞི', roman: 'shi' },
  { value: 5, digits: '༥', word: 'ལྔ', roman: 'nga' },
  { value: 6, digits: '༦', word: 'དྲུག', roman: 'druk' },
  { value: 7, digits: '༧', word: 'བདུན', roman: 'dün' },
  { value: 8, digits: '༨', word: 'བརྒྱད', roman: 'gyä' },
  { value: 9, digits: '༩', word: 'དགུ', roman: 'gu' },
]

export const TENS: Numeral[] = [
  { value: 10, digits: '༡༠', word: 'བཅུ', roman: 'chu' },
  { value: 20, digits: '༢༠', word: 'ཉི་ཤུ', roman: 'nyi shu' },
  { value: 30, digits: '༣༠', word: 'སུམ་ཅུ', roman: 'sum chu' },
  { value: 40, digits: '༤༠', word: 'བཞི་བཅུ', roman: 'shi chu' },
  { value: 50, digits: '༥༠', word: 'ལྔ་བཅུ', roman: 'nga chu' },
  { value: 60, digits: '༦༠', word: 'དྲུག་ཅུ', roman: 'druk chu' },
  { value: 70, digits: '༧༠', word: 'བདུན་ཅུ', roman: 'dün chu' },
  { value: 80, digits: '༨༠', word: 'བརྒྱད་ཅུ', roman: 'gyä chu' },
  { value: 90, digits: '༩༠', word: 'དགུ་བཅུ', roman: 'gu chu' },
  { value: 100, digits: '༡༠༠', word: 'བརྒྱ', roman: 'gya' },
]

/** Digits and tens together — the pool the write/read drills draw from. */
export const NUMERALS: Numeral[] = [...DIGITS, ...TENS]

const TIBETAN_ZERO = 0x0f20

/** 27 → ༢༧ */
export function toTibetanDigits(n: number): string {
  return String(n)
    .split('')
    .map((d) => String.fromCodePoint(TIBETAN_ZERO + Number(d)))
    .join('')
}

export const LEVEL2_META = {
  questions: {
    title: 'Question forms',
    focus: 'Six question words, and the gaps they fill.',
  },
  verbs: {
    title: 'Verb basics',
    focus: 'Present and past stems — with the collapsed ones flagged.',
  },
  numbers: {
    title: 'Numbers in speech',
    focus: 'Hear a number and write it; read one aloud.',
  },
}
