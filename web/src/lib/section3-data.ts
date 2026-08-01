/**
 * Level 1 — Section 3: Syllable architecture.
 *
 * Tibetan syllables stack letters around a root. Beginners hit a wall when
 * five written letters produce one sound — most letters are silent or only
 * colour the tone. Frontend-only curated examples.
 */

export type SlotKey = 'prefix' | 'root' | 'vowel' | 'suffix' | 'post'

export interface SlotPiece {
  key: SlotKey
  /** Glyph shown in the slot (empty string = vacant) */
  glyph: string
  /** Whether this slot contributes an audible segment in Lhasa speech */
  heard: boolean
  label: string
}

/** Extra stack pieces shown only in Anatomy (not in the 5-slot builder). */
export interface StackExtra {
  key: 'super' | 'sub'
  glyph: string
  heard: boolean
  label: string
}

export interface SyllableExample {
  id: string
  /** Full written form */
  text: string
  roman: string
  gloss: string
  writtenCount: number
  heardSummary: string
  slots: SlotPiece[]
  extras?: StackExtra[]
  note?: string
}

export type QuizAnswer = 'vowel' | 'softened' | 'nothing' | 'root'

export interface SoundQuizItem {
  id: string
  prompt: string
  before: string
  after: string
  beforeRoman: string
  afterRoman: string
  answer: QuizAnswer
  options: { key: QuizAnswer; label: string }[]
}

export const SLOT_ORDER: SlotKey[] = ['prefix', 'root', 'vowel', 'suffix', 'post']

export const SLOT_HEADERS: Record<SlotKey, { short: string; tibetan: string; en: string }> = {
  prefix: { short: 'Pre', tibetan: 'སྔོན་འཇུག', en: 'prefix' },
  root: { short: 'Root', tibetan: 'མིང་གཞི', en: 'root' },
  vowel: { short: 'Vowel', tibetan: 'དབྱངས', en: 'vowel' },
  suffix: { short: 'Suffix', tibetan: 'རྗེས་འཇུག', en: 'suffix' },
  post: { short: 'Post', tibetan: 'ཡང་འཇུག', en: 'post-suffix' },
}

export const SYLLABLES: SyllableExample[] = [
  {
    id: 'gnas',
    text: 'གནས་',
    roman: 'nä',
    gloss: 'place / abode',
    writtenCount: 3,
    heardSummary: '3 letters written · 1 heard',
    slots: [
      { key: 'prefix', glyph: 'ག', heard: false, label: 'prefix silent' },
      { key: 'root', glyph: 'ན', heard: true, label: 'root heard' },
      { key: 'vowel', glyph: '', heard: false, label: 'inherent a' },
      { key: 'suffix', glyph: 'ས', heard: false, label: 'suffix silent' },
      { key: 'post', glyph: '', heard: false, label: '—' },
    ],
    note: 'Prefix and suffix are written but not pronounced in Lhasa — you hear the root.',
  },
  {
    id: 'bod',
    text: 'བོད་',
    roman: 'bö',
    gloss: 'Tibet',
    writtenCount: 3,
    heardSummary: '3 letters written · root + vowel heard',
    slots: [
      { key: 'prefix', glyph: '', heard: false, label: '—' },
      { key: 'root', glyph: 'བ', heard: true, label: 'root heard' },
      { key: 'vowel', glyph: 'ོ', heard: true, label: 'vowel o' },
      { key: 'suffix', glyph: 'ད', heard: false, label: 'suffix silent' },
      { key: 'post', glyph: '', heard: false, label: '—' },
    ],
  },
  {
    id: 'yod',
    text: 'ཡོད་',
    roman: 'yö',
    gloss: 'to exist / have',
    writtenCount: 3,
    heardSummary: '3 letters written · root + vowel heard',
    slots: [
      { key: 'prefix', glyph: '', heard: false, label: '—' },
      { key: 'root', glyph: 'ཡ', heard: true, label: 'root heard' },
      { key: 'vowel', glyph: 'ོ', heard: true, label: 'vowel o' },
      { key: 'suffix', glyph: 'ད', heard: false, label: 'suffix silent' },
      { key: 'post', glyph: '', heard: false, label: '—' },
    ],
  },
  {
    id: 'lags',
    text: 'ལགས་',
    roman: 'la',
    gloss: 'honorific particle',
    writtenCount: 3,
    heardSummary: '3 letters written · 1 heard',
    slots: [
      { key: 'prefix', glyph: '', heard: false, label: '—' },
      { key: 'root', glyph: 'ལ', heard: true, label: 'root heard' },
      { key: 'vowel', glyph: '', heard: false, label: 'inherent a' },
      { key: 'suffix', glyph: 'ག', heard: false, label: 'suffix silent' },
      { key: 'post', glyph: 'ས', heard: false, label: 'post-suffix silent' },
    ],
  },
  {
    id: 'bsgrubs',
    text: 'བསྒྲུབས',
    roman: 'drup',
    gloss: 'accomplished (past)',
    writtenCount: 6,
    heardSummary: '6 letters written · roughly 1 syllable heard',
    slots: [
      { key: 'prefix', glyph: 'བ', heard: false, label: 'prefix silent' },
      { key: 'root', glyph: 'ག', heard: true, label: 'root (coloured by stack)' },
      { key: 'vowel', glyph: 'ུ', heard: true, label: 'vowel u' },
      { key: 'suffix', glyph: 'བ', heard: false, label: 'suffix silent' },
      { key: 'post', glyph: 'ས', heard: false, label: 'post-suffix silent' },
    ],
    extras: [
      { key: 'super', glyph: 'ས', heard: false, label: 'superscript (mgo can)' },
      { key: 'sub', glyph: 'ར', heard: true, label: 'subscript ra-btags' },
    ],
    note: 'Full stack: prefix, superscript, root, subscript, vowel, suffix, post-suffix. Most letters are silent; the stack colours the sound of the root.',
  },
  {
    id: 'chu',
    text: 'ཆུ་',
    roman: 'chu',
    gloss: 'water',
    writtenCount: 2,
    heardSummary: '2 letters written · both heard',
    slots: [
      { key: 'prefix', glyph: '', heard: false, label: '—' },
      { key: 'root', glyph: 'ཆ', heard: true, label: 'root heard' },
      { key: 'vowel', glyph: 'ུ', heard: true, label: 'vowel u' },
      { key: 'suffix', glyph: '', heard: false, label: '—' },
      { key: 'post', glyph: '', heard: false, label: '—' },
    ],
  },
]

export const SOUND_QUIZ: SoundQuizItem[] = [
  {
    id: 'q1',
    prompt: 'I changed the vowel slot. What changed in the sound?',
    before: 'བོད་',
    after: 'བུད་',
    beforeRoman: 'bö',
    afterRoman: 'bü',
    answer: 'vowel',
    options: [
      { key: 'vowel', label: 'Vowel bent' },
      { key: 'softened', label: 'Consonant softened' },
      { key: 'nothing', label: 'Nothing audible' },
      { key: 'root', label: 'Root letter changed' },
    ],
  },
  {
    id: 'q2',
    prompt: 'I added a silent prefix. What changed in the sound?',
    before: 'ནས་',
    after: 'གནས་',
    beforeRoman: 'nä',
    afterRoman: 'nä',
    answer: 'nothing',
    options: [
      { key: 'vowel', label: 'Vowel bent' },
      { key: 'softened', label: 'Consonant softened' },
      { key: 'nothing', label: 'Nothing audible' },
      { key: 'root', label: 'Root letter changed' },
    ],
  },
  {
    id: 'q3',
    prompt: 'I changed the root letter. What changed in the sound?',
    before: 'ཡོད་',
    after: 'བོད་',
    beforeRoman: 'yö',
    afterRoman: 'bö',
    answer: 'root',
    options: [
      { key: 'vowel', label: 'Vowel bent' },
      { key: 'softened', label: 'Consonant softened' },
      { key: 'nothing', label: 'Nothing audible' },
      { key: 'root', label: 'Root letter changed' },
    ],
  },
  {
    id: 'q4',
    prompt: 'I removed a silent suffix. What changed in the sound?',
    before: 'ཆུད་',
    after: 'ཆུ་',
    beforeRoman: 'chu',
    afterRoman: 'chu',
    answer: 'nothing',
    options: [
      { key: 'vowel', label: 'Vowel bent' },
      { key: 'softened', label: 'Consonant softened' },
      { key: 'nothing', label: 'Nothing audible' },
      { key: 'root', label: 'Root letter changed' },
    ],
  },
]

export function slotsToText(slots: SlotPiece[]): string {
  const get = (k: SlotKey) => slots.find((s) => s.key === k)?.glyph ?? ''
  return `${get('prefix')}${get('root')}${get('vowel')}${get('suffix')}${get('post')}`
}

export const SECTION3_META = {
  title: 'Syllable architecture',
  focus:
    'Prefix → root → vowel → suffix → post-suffix. Five written letters can produce one sound.',
}
