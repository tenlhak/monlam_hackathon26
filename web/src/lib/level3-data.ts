/**
 * Level 3, Section 1 — The eight cases (རྣམ་དབྱེ་བརྒྱད). Frontend-only content.
 *
 * Traditional Tibetan grammar numbers these 1st–8th; the three that carry
 * suffix-conditioned allomorphs (genitive, agentive, la-don/dative) are what
 * learners actually get wrong, so the particle drill focuses there. The
 * other five cases are single-particle (or zero-particle) and only need the
 * Rules/Examples tabs.
 *
 * NOTE: curated, not generated, but not reviewed by a native speaker.
 * Verify before this ships to learners.
 */

export type CaseId =
  | 'nominative'
  | 'accusative'
  | 'agentive'
  | 'dative'
  | 'ablative'
  | 'genitive'
  | 'locative'
  | 'vocative'

export interface CaseInfo {
  id: CaseId
  number: number
  name: string
  tibetanName: string
  particles: string[]
  function: string
  conditioned: boolean
}

export const CASES: CaseInfo[] = [
  {
    id: 'nominative',
    number: 1,
    name: 'Nominative',
    tibetanName: 'ངོ་བོའི་རྣམ་དབྱེ',
    particles: ['— (none)'],
    function: 'Plain subject of an intransitive or stative verb — unmarked.',
    conditioned: false,
  },
  {
    id: 'accusative',
    number: 2,
    name: 'Accusative',
    tibetanName: 'ལས་སུ་བྱ་བའི་རྣམ་དབྱེ',
    particles: ['— (none)'],
    function: 'Direct object of a transitive verb — also unmarked.',
    conditioned: false,
  },
  {
    id: 'agentive',
    number: 3,
    name: 'Agentive',
    tibetanName: 'བྱེད་སྒྲའི་རྣམ་དབྱེ',
    particles: ['གིས', 'ཀྱིས', 'གྱིས', 'ཡིས'],
    function: 'Marks the agent of a transitive verb — "by/through X".',
    conditioned: true,
  },
  {
    id: 'dative',
    number: 4,
    name: 'La-don (dative)',
    tibetanName: 'དགོས་ཆེད་ཀྱི་རྣམ་དབྱེ',
    particles: ['ལ', 'ན', 'ར', 'དུ', 'ཏུ', 'སུ'],
    function: 'Direction, purpose, recipient, or point in time — "to/at/for X".',
    conditioned: true,
  },
  {
    id: 'ablative',
    number: 5,
    name: 'Ablative',
    tibetanName: 'འབྱུང་ཁུངས་ཀྱི་རྣམ་དབྱེ',
    particles: ['ནས', 'ལས'],
    function: 'Source or comparison — "from X" / "more than X". Chosen by meaning, not the preceding letter.',
    conditioned: false,
  },
  {
    id: 'genitive',
    number: 6,
    name: 'Genitive',
    tibetanName: 'འབྲེལ་བའི་རྣམ་དབྱེ',
    particles: ['གི', 'ཀྱི', 'གྱི', 'འི', 'ཡི'],
    function: 'Possession or modification — "X\'s" / "of X".',
    conditioned: true,
  },
  {
    id: 'locative',
    number: 7,
    name: 'Locative',
    tibetanName: 'རྟེན་གནས་ཀྱི་རྣམ་དབྱེ',
    particles: ['ན'],
    function: 'Where something exists or happens — "in/at X" (stative).',
    conditioned: false,
  },
  {
    id: 'vocative',
    number: 8,
    name: 'Vocative',
    tibetanName: 'བོད་པའི་རྣམ་དབྱེ',
    particles: ['ལགས', 'ཀྱེ'],
    function: 'Directly addressing someone — "hey, X!" / a polite call.',
    conditioned: false,
  },
]

// ─────────────────────────────────────── Suffix-conditioned selection rule

export type FinalGroup = 'hard' | 'soft' | 'open'

export interface FinalRule {
  group: FinalGroup
  label: string
  finals: string[]
  genitive: string
  agentive: string
  dative: string
}

/** The 3-way split every allomorph-conditioned particle follows. */
export const FINAL_RULES: FinalRule[] = [
  {
    group: 'hard',
    label: 'ག ད བ',
    finals: ['ག', 'ད', 'བ'],
    genitive: 'ཀྱི',
    agentive: 'ཀྱིས',
    dative: 'ཏུ',
  },
  {
    group: 'soft',
    label: 'ང ན མ འ ར ལ',
    finals: ['ང', 'ན', 'མ', 'འ', 'ར', 'ལ'],
    genitive: 'གྱི',
    agentive: 'གྱིས',
    dative: 'དུ',
  },
  {
    group: 'open',
    label: 'ས, or no final (open syllable)',
    finals: ['ས', '◌'],
    genitive: 'འི',
    agentive: 'ཡིས',
    dative: 'ར',
  },
]

export interface CaseWord {
  id: string
  text: string
  roman: string
  en: string
  final: string
  group: FinalGroup
}

/** Word bank used by the particle-selection drill — tagged by final letter. */
export const CASE_WORDS: CaseWord[] = [
  { id: 'bo', text: 'བོད', roman: 'bö', en: 'Tibet', final: 'ད', group: 'hard' },
  { id: 'lak', text: 'ལག', roman: 'lak', en: 'hand', final: 'ག', group: 'hard' },
  { id: 'nub', text: 'ནུབ', roman: 'nub', en: 'west', final: 'བ', group: 'hard' },
  { id: 'zhing', text: 'ཞིང', roman: 'zhing', en: 'field', final: 'ང', group: 'soft' },
  { id: 'tsen', text: 'མཚན', roman: 'tsen', en: 'name', final: 'ན', group: 'soft' },
  { id: 'khyim', text: 'ཁྱིམ', roman: 'khyim', en: 'house', final: 'མ', group: 'soft' },
  { id: 'khar', text: 'མཁར', roman: 'khar', en: 'fort', final: 'ར', group: 'soft' },
  { id: 'yul', text: 'ཡུལ', roman: 'yul', en: 'place', final: 'ལ', group: 'soft' },
  { id: 'lu', text: 'ལུས', roman: 'lü', en: 'body', final: 'ས', group: 'open' },
  { id: 'mi', text: 'མི', roman: 'mi', en: 'person', final: '(vowel)', group: 'open' },
]

export type ConditionedCase = 'genitive' | 'agentive' | 'dative'

export function particleFor(word: CaseWord, kase: ConditionedCase): string {
  const rule = FINAL_RULES.find((r) => r.group === word.group)!
  return rule[kase]
}

// ─────────────────────────────────────────────────────── Ablative: nas vs las

export interface AblativeItem {
  id: string
  before: string
  after: string
  answer: 'ནས' | 'ལས'
  en: string
  hint: string
}

export const ABLATIVE_ITEMS: AblativeItem[] = [
  {
    id: 'ab1',
    before: 'ང་ཁྱིམ་',
    after: '་ཡོང་གི་ཡིན།',
    answer: 'ནས',
    en: 'I am coming from home.',
    hint: 'A real starting point of motion → ནས',
  },
  {
    id: 'ab2',
    before: 'འདི་དེ་',
    after: '་ཡག་པོ་རེད།',
    answer: 'ལས',
    en: 'This is better than that.',
    hint: 'Comparison ("more than") → ལས',
  },
  {
    id: 'ab3',
    before: 'ང་བོད་',
    after: '་ཡིན།',
    answer: 'ལས',
    en: 'I am from Tibet. (origin, not motion)',
    hint: 'Where someone is from, stated as a fact → ལས',
  },
  {
    id: 'ab4',
    before: 'དེབ་འདི་སྤེན་པ་',
    after: '་བླངས་པ་རེད།',
    answer: 'ནས',
    en: 'This book was taken from Penpa.',
    hint: 'A concrete source the object moved from → ནས',
  },
]

// ──────────────────────────────────────────────────────────── Speak drill

export interface CaseSentence {
  id: string
  caseId: CaseId
  text: string
  roman: string
  en: string
}

export const SPEAK_SENTENCES: CaseSentence[] = [
  {
    id: 's1',
    caseId: 'nominative',
    text: 'བོད་ཡག་པོ་རེད།',
    roman: 'bö yakpo ré',
    en: 'Tibet is good.',
  },
  {
    id: 's2',
    caseId: 'accusative',
    text: 'ང་ཇ་འཐུང་གི་ཡོད།',
    roman: 'nga ja thung gi yö',
    en: 'I am drinking tea.',
  },
  {
    id: 's3',
    caseId: 'agentive',
    text: 'བུ་མོས་ཞིང་ལས་བྱས།',
    roman: 'bumö zhing lä jä',
    en: 'The girl worked the field.',
  },
  {
    id: 's4',
    caseId: 'dative',
    text: 'ང་བོད་ལ་འགྲོ་གི་ཡིན།',
    roman: 'nga bö la dro gi yin',
    en: 'I am going to Tibet.',
  },
  {
    id: 's5',
    caseId: 'ablative',
    text: 'ང་ཁྱིམ་ནས་ཡོང་གི་ཡིན།',
    roman: 'nga khyim nä yong gi yin',
    en: 'I am coming from home.',
  },
  {
    id: 's6',
    caseId: 'genitive',
    text: 'འདི་ང་ཡི་དེབ་རེད།',
    roman: 'di nga yi dep ré',
    en: 'This is my book.',
  },
  {
    id: 's7',
    caseId: 'locative',
    text: 'ང་ཁྱིམ་ན་ཡོད།',
    roman: 'nga khyim na yö',
    en: 'I am at home.',
  },
  {
    id: 's8',
    caseId: 'vocative',
    text: 'བུ་མོ་ལགས། ཚུར་ཤོག',
    roman: 'bumo lak, tsur shok',
    en: 'Girl! Come here.',
  },
]
