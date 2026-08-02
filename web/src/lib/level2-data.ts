/**
 * Level 2 — Functional beginner. Frontend-only drill content.
 *
 * Covers all five sections:
 *   2.1 themed vocabulary · 2.2 question forms · 2.3 verb basics ·
 *   2.4 numbers in speech · 2.5 simple dialogues
 *
 * Register matters here in a way it did not in Level 1. Several of the
 * question words are literary forms a learner will read but never hear, so
 * each one carries its spoken Lhasa equivalent and drills render whichever
 * register the exercise is set in.
 *
 * NOTE: the Tibetan below is curated, not generated, but it has not been
 * reviewed by a native speaker. Verify before this ships to learners.
 */

// ─────────────────────────────────────────────── 2.1 Themed vocabulary

export type VocabCategory =
  | 'routine'
  | 'transport'
  | 'shopping'
  | 'weather'
  | 'body'
  | 'time'

export interface VocabItem {
  id: string
  category: VocabCategory
  text: string
  roman: string
  en: string
}

export const VOCAB_CATEGORIES: { id: VocabCategory; label: string }[] = [
  { id: 'routine', label: 'Daily routine' },
  { id: 'transport', label: 'Transport' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'weather', label: 'Weather' },
  { id: 'body', label: 'Body' },
  { id: 'time', label: 'Time' },
]

export const THEMED_VOCAB: VocabItem[] = [
  { id: 'khyim', category: 'routine', text: 'ཁྱིམ', roman: 'khyim', en: 'home' },
  { id: 'layka', category: 'routine', text: 'ལས་ཀ', roman: 'lay ka', en: 'work' },
  { id: 'zhokpa', category: 'routine', text: 'ཞོགས་པ', roman: 'zhokpa', en: 'morning' },
  { id: 'gongmo', category: 'routine', text: 'དགོང་མོ', roman: 'gongmo', en: 'evening' },
  { id: 'ja', category: 'routine', text: 'ཇ', roman: 'ja', en: 'tea' },

  { id: 'mota', category: 'transport', text: 'མོ་ཊ', roman: 'mota', en: 'car' },
  { id: 'kangkhor', category: 'transport', text: 'ཀང་འཁོར', roman: 'kang khor', en: 'bicycle' },
  { id: 'mekhor', category: 'transport', text: 'མེ་འཁོར', roman: 'me khor', en: 'train' },
  { id: 'namdru', category: 'transport', text: 'གནམ་གྲུ', roman: 'namdru', en: 'airplane' },
  { id: 'lamka', category: 'transport', text: 'ལམ་ཀ', roman: 'lamka', en: 'road' },

  { id: 'ngul', category: 'shopping', text: 'དངུལ', roman: 'ngül', en: 'money' },
  { id: 'tsongkhang', category: 'shopping', text: 'ཚོང་ཁང', roman: 'tsong khang', en: 'shop' },
  { id: 'gong', category: 'shopping', text: 'གོང', roman: 'gong', en: 'price' },
  { id: 'throm', category: 'shopping', text: 'ཁྲོམ', roman: 'throm', en: 'market' },
  { id: 'nyo', category: 'shopping', text: 'ཉོ', roman: 'nyo', en: 'buy' },

  { id: 'nyima', category: 'weather', text: 'ཉི་མ', roman: 'nyima', en: 'sun' },
  { id: 'charpa', category: 'weather', text: 'ཆར་པ', roman: 'charpa', en: 'rain' },
  { id: 'khawa', category: 'weather', text: 'ཁ་བ', roman: 'khawa', en: 'snow' },
  { id: 'lung', category: 'weather', text: 'རླུང', roman: 'lung', en: 'wind' },
  { id: 'drangmo', category: 'weather', text: 'གྲང་མོ', roman: 'drangmo', en: 'cold' },

  { id: 'go', category: 'body', text: 'མགོ', roman: 'go', en: 'head' },
  { id: 'lakpa', category: 'body', text: 'ལག་པ', roman: 'lakpa', en: 'hand' },
  { id: 'mik', category: 'body', text: 'མིག', roman: 'mik', en: 'eye' },
  { id: 'kangpa', category: 'body', text: 'རྐང་པ', roman: 'kangpa', en: 'leg / foot' },
  { id: 'drokok', category: 'body', text: 'གྲོད་ཁོག', roman: 'drökok', en: 'stomach' },

  { id: 'tering', category: 'time', text: 'དེ་རིང', roman: 'tering', en: 'today' },
  { id: 'sangnyin', category: 'time', text: 'སང་ཉིན', roman: 'sang nyin', en: 'tomorrow' },
  { id: 'khasang', category: 'time', text: 'ཁ་སང', roman: 'khasang', en: 'yesterday' },
  { id: 'danta', category: 'time', text: 'ད་ལྟ', roman: 'danta', en: 'now' },
  { id: 'chutso', category: 'time', text: 'ཆུ་ཚོད', roman: 'chutsö', en: 'hour / o’clock' },
]

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

// 2.4's digit set now lives in lib/numerals.ts, shared with Level 1 §5.

// ─────────────────────────────────────────────── 2.5 Simple dialogues

export interface DialogueLine {
  speaker: 'A' | 'B'
  text: string
  roman: string
  en: string
}

export interface Dialogue {
  id: string
  title: string
  lines: DialogueLine[]
}

export const DIALOGUES: Dialogue[] = [
  {
    id: 'introductions',
    title: 'Introductions',
    lines: [
      { speaker: 'A', text: 'བཀྲ་ཤིས་བདེ་ལེགས།', roman: 'tashi delek', en: 'Hello.' },
      {
        speaker: 'B',
        text: 'བཀྲ་ཤིས་བདེ་ལེགས། ཁྱེད་རང་གི་མིང་ལ་ག་རེ་ཟེར་གྱི་ཡོད།',
        roman: 'tashi delek. khyerang gi ming la kare zergyi yö?',
        en: 'Hello. What is your name?',
      },
      {
        speaker: 'A',
        text: 'ངའི་མིང་ལ་བསྟན་འཛིན་ཟེར་གྱི་ཡོད།',
        roman: 'ngä ming la tenzin zergyi yö',
        en: 'My name is Tenzin.',
      },
      {
        speaker: 'B',
        text: 'ཧ་གོ་སོང༌། ང་ལ་དགའ་པོ་བྱུང༌།',
        roman: 'hago song. nga la gapo jung',
        en: 'I see. Nice to meet you.',
      },
    ],
  },
  {
    id: 'ordering-food',
    title: 'Ordering food',
    lines: [
      { speaker: 'A', text: 'ཇ་ཞིག་འདུག་གམ།', roman: 'ja shik dug gam?', en: 'Is there tea?' },
      {
        speaker: 'B',
        text: 'འདུག ཇ་འདྲ་མིན་འདུག',
        roman: 'dug. ja dra min dug',
        en: 'Yes, there are different kinds.',
      },
      {
        speaker: 'A',
        text: 'ཇ་ངར་མོ་ཞིག་ཨིན།',
        roman: 'ja ngarmo shik in',
        en: "I'll have sweet tea.",
      },
      {
        speaker: 'B',
        text: 'ལགས་སོ། སྐར་མ་གཅིག་སྒུག་དང༌།',
        roman: 'lakso. karma chik guk dang',
        en: 'Okay. One minute please.',
      },
    ],
  },
  {
    id: 'directions',
    title: 'Asking directions',
    lines: [
      {
        speaker: 'A',
        text: 'དགོན་པ་ག་པར་ཡོད།',
        roman: 'gönpa gapar yö?',
        en: 'Where is the monastery?',
      },
      {
        speaker: 'B',
        text: 'གཡས་ཕྱོགས་ལ་འགྲོ་དགོས།',
        roman: 'yay chok la dro gö',
        en: 'Go to the right.',
      },
      { speaker: 'A', text: 'ཐག་རིང་པོ་ཡོད་པས།', roman: 'tak ringpo yöpe?', en: 'Is it far?' },
      { speaker: 'B', text: 'མ་རེད། ཉེ་པོ་རེད།', roman: 'maré. nyepo ré', en: "No, it's close." },
    ],
  },
  {
    id: 'shopping',
    title: 'Shopping',
    lines: [
      {
        speaker: 'A',
        text: 'འདི་གོང་ཚད་ག་ཚོད་རེད།',
        roman: 'di gongtsé katsö ré?',
        en: 'How much is this?',
      },
      { speaker: 'B', text: 'སྒོར་ཉི་ཤུ་རེད།', roman: 'gor nyishu ré', en: 'Twenty.' },
      {
        speaker: 'A',
        text: 'ཆུང་ཙམ་བཏང་རོགས།',
        roman: 'chungtsam tang rok',
        en: 'Please make it a bit cheaper.',
      },
      {
        speaker: 'B',
        text: 'ལགས་སོ། སྒོར་བཅོ་ལྔ་ཨིན་ན།',
        roman: 'lakso. gor chonga inna?',
        en: 'Okay, how about fifteen?',
      },
    ],
  },
]

export const LEVEL2_META = {
  vocab: {
    title: 'Themed vocabulary',
    focus: 'Daily routine, transport, shopping, weather, body, time.',
  },
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
  dialogues: {
    title: 'Simple dialogues',
    focus: 'Introductions, ordering food, directions, shopping.',
  },
}
