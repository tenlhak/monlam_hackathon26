/**
 * Placement quiz content — 3 phases, 3 questions each.
 *
 * Phase 1 gates script literacy, Phase 2 vocabulary and basic grammar,
 * Phase 3 advanced structures. Scoring and routing live in ./routing.ts.
 *
 * Feedback is shown immediately after answering, so both branches are
 * pre-authored: `pass` reinforces, `fail` explains the contrast rather than
 * only marking the answer wrong.
 */

export type Phase = 1 | 2 | 3

export interface QuizOption {
  id: string
  text: string
  /** Render in the Tibetan face — set for glyphs, not for English labels */
  tibetan?: boolean
  correct: boolean
}

export interface QuizQuestion {
  id: string
  phase: Phase
  question: string
  /**
   * The Tibetan the question is about, shown large in the Tibetan face.
   * Kept out of `question` and `hint` so it is never rendered as small muted
   * body text in a Latin font — for most of these it *is* the question.
   */
  subject?: string
  /** Supporting line under the subject — context, not part of the prompt */
  hint: string
  options: QuizOption[]
  feedback: { pass: string; fail: string }
}

export const PHASE_NAMES: Record<Phase, string> = {
  1: 'Phase 1: Script recognition',
  2: 'Phase 2: Vocabulary and grammar',
  3: 'Phase 3: Advanced structures',
}

export const PHASE_LABELS: Record<Phase, string> = {
  1: 'script',
  2: 'vocabulary',
  3: 'advanced',
}

export const QUESTIONS: QuizQuestion[] = [
  {
    id: 'p1q1',
    phase: 1,
    question: 'Which of these is a Tibetan consonant?',
    hint: 'Select the Tibetan letter.',
    options: [
      { id: 'a', text: 'ཀ', tibetan: true, correct: true },
      { id: 'b', text: 'あ', correct: false },
      { id: 'c', text: 'ك', correct: false },
      { id: 'd', text: 'Δ', correct: false },
    ],
    feedback: {
      pass: 'ཀ (ka) is the first letter of the Tibetan alphabet.',
      fail: 'ཀ is the Tibetan consonant. The others are Japanese hiragana, Arabic, and Greek.',
    },
  },
  {
    id: 'p1q2',
    phase: 1,
    question: 'How many letters is this syllable?',
    subject: 'གནས',
    hint: 'Count all written components.',
    options: [
      { id: 'a', text: '1', correct: false },
      { id: 'b', text: '2', correct: false },
      { id: 'c', text: '3', correct: true },
      { id: 'd', text: '4', correct: false },
    ],
    feedback: {
      pass: 'གནས has 3 letters: ག (prefix) + ན (root) + ས (suffix). But only 1 is heard — it sounds like "nä".',
      fail: 'གནས has 3 letters: ག (silent prefix), ན (root, heard), ས (silent suffix). Only "nä" is spoken.',
    },
  },
  {
    id: 'p1q3',
    phase: 1,
    question: 'What does the ཚེག ( ་ ) do?',
    hint: 'The small dot between syllables.',
    options: [
      { id: 'a', text: 'It marks a sentence ending', correct: false },
      { id: 'b', text: 'It separates syllables within a word', correct: true },
      { id: 'c', text: 'It indicates a question', correct: false },
      { id: 'd', text: 'It is decorative only', correct: false },
    ],
    feedback: {
      pass: 'Correct. The ཚེག is a syllable separator — it is one of the first punctuation marks a reader needs to understand.',
      fail: 'The ཚེག separates syllables. The ཤད (།) marks sentence endings. There are no question marks in traditional Tibetan punctuation.',
    },
  },
  {
    id: 'p2q1',
    phase: 2,
    question: 'Complete the sentence',
    subject: 'ང་ བོད་པ་ ___',
    hint: '"I am Tibetan." — choose the correct copula.',
    options: [
      { id: 'a', text: 'རེད', tibetan: true, correct: false },
      { id: 'b', text: 'ཡིན', tibetan: true, correct: true },
      { id: 'c', text: 'འདུག', tibetan: true, correct: false },
      { id: 'd', text: 'ཡོད', tibetan: true, correct: false },
    ],
    feedback: {
      pass: 'ཡིན is correct for first-person identity statements — the speaker knows this from their own experience.',
      fail: 'ཡིན is correct here. རེད would imply a fact others can verify. འདུག means "I just noticed." ཡིན is for personal identity.',
    },
  },
  {
    id: 'p2q2',
    phase: 2,
    question: 'What does this phrase mean?',
    subject: 'ཐུགས་རྗེ་ཆེ',
    hint: 'A common Tibetan phrase.',
    options: [
      { id: 'a', text: 'Good morning', correct: false },
      { id: 'b', text: 'Yes', correct: false },
      { id: 'c', text: 'Thank you', correct: true },
      { id: 'd', text: 'Goodbye', correct: false },
    ],
    feedback: {
      pass: 'ཐུགས་རྗེ་ཆེ (thugs rje che) is the standard expression of thanks.',
      fail: 'ཐུགས་རྗེ་ཆེ means "thank you". བཀྲ་ཤིས་བདེ་ལེགས is the common greeting.',
    },
  },
  {
    id: 'p2q3',
    phase: 2,
    question: 'Which particle marks the agentive case?',
    hint: 'The "doer" of a transitive action.',
    options: [
      { id: 'a', text: 'ལ', tibetan: true, correct: false },
      { id: 'b', text: 'གིས / ཀྱིས', tibetan: true, correct: true },
      { id: 'c', text: 'ནས', tibetan: true, correct: false },
      { id: 'd', text: 'འི', tibetan: true, correct: false },
    ],
    feedback: {
      pass: 'གིས / ཀྱིས is the agentive — it marks who performed the action. The form depends on the final letter of the preceding syllable.',
      fail: 'གིས / ཀྱིས is agentive. ལ is la-don (direction/purpose). ནས is ablative (from). འི is genitive (of/possessive).',
    },
  },
  {
    id: 'p3q1',
    phase: 3,
    question: 'What does this sentence express?',
    subject: 'ཁོ་ལ་དེབ་ཡོད།',
    hint: 'Read the full sentence carefully.',
    options: [
      { id: 'a', text: 'He wants a book', correct: false },
      {
        id: 'b',
        text: 'He has a book (speaker knows from experience)',
        correct: true,
      },
      { id: 'c', text: 'He just noticed he has a book', correct: false },
      { id: 'd', text: 'There is a book generally', correct: false },
    ],
    feedback: {
      pass: 'ཡོད expresses existence/possession known to the speaker from direct experience — distinct from འདུག (just noticed) or ཡོད་རེད (general fact).',
      fail: 'ཡོད marks existence the speaker knows from experience. འདུག would mean they just noticed. ཡོད་རེད would be a general, verifiable fact.',
    },
  },
  {
    id: 'p3q2',
    phase: 3,
    question: 'What is the honorific form of this word?',
    subject: 'ལག་པ',
    hint: 'ལག་པ (hand) · ཞེ་ས — choosing the correct register.',
    options: [
      { id: 'a', text: 'ལག་འཛིན', tibetan: true, correct: false },
      { id: 'b', text: 'ཕྱག', tibetan: true, correct: true },
      { id: 'c', text: 'མཁར', tibetan: true, correct: false },
      { id: 'd', text: 'སྐུ་ལག', tibetan: true, correct: false },
    ],
    feedback: {
      pass: 'ཕྱག is the honorific for hand/arm, used when speaking about or to someone of higher status. The ordinary ལག་པ would be inappropriate.',
      fail: 'ཕྱག is the honorific form. Tibetan has full parallel vocabulary for ordinary and honorific registers — one of the core features of the language.',
    },
  },
  {
    id: 'p3q3',
    phase: 3,
    question: 'Which script is this?',
    subject: 'དབུ་མེད',
    hint: 'Identify the Tibetan cursive script.',
    options: [
      {
        id: 'a',
        text: 'The standard printed block script (uchen)',
        correct: false,
      },
      {
        id: 'b',
        text: 'The cursive handwritten script used in everyday writing',
        correct: true,
      },
      { id: 'c', text: 'Classical woodblock script for pecha', correct: false },
      { id: 'd', text: 'A script used only for sacred texts', correct: false },
    ],
    feedback: {
      pass: 'དབུ་མེད ("without a head") is cursive Tibetan — letters flow without the horizontal headline of uchen. It is used in handwriting and informal text.',
      fail: 'དབུ་མེད is the cursive everyday script. དབུ་ཅན (uchen, "with a head") is the standard printed form used in Level 1.',
    },
  },
]
