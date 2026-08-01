/**
 * Curated resources for learning Tibetan outside MunSel.
 *
 * Every entry here was checked by fetching the URL, not recalled from memory —
 * a resources page whose links 404 is worse than no page at all. `checked` is
 * the date that verification last happened.
 *
 * The `register` field is the one that earns this page its keep. Tibetan
 * learning material splits hard between spoken language and literary/classical
 * Tibetan, and most link lists online conflate the two. Someone who wants to
 * talk to their family does not want a Buddhist text reader, and the confusion
 * costs beginners months. It is the same split that makes a dictionary answer
 * "beautiful" with བཀྲ་བ ("shining, variegated") when the learner needed མཛེས་པོ།.
 */

export type ResourceKind = 'book' | 'video' | 'course' | 'tool';

/** Which flavour of Tibetan this teaches. */
export type Register =
  /** Everyday speech — what you need to hold a conversation. */
  | 'colloquial'
  /** Classical and literary — for reading texts. */
  | 'literary'
  | 'both';

export type Cost = 'free' | 'paid' | 'mixed';

export interface Resource {
  id: string;
  title: string;
  /** Author, channel, or the institution behind it. */
  by: string;
  url: string;
  kind: ResourceKind;
  register: Register;
  cost: Cost;
  /** MunSel levels (1–5) this suits, so the page can meet a learner where they are. */
  levels: number[];
  /** Why it is worth your time. The curation is the point, not the link. */
  note: string;
  /** ISO date the URL was last confirmed to resolve. */
  checked: string;
}

const CHECKED = '2026-08-02';

export const RESOURCES: Resource[] = [
  // ── Books ────────────────────────────────────────────────────────────────
  {
    id: 'tournadre-manual',
    title: 'Manual of Standard Tibetan',
    by: 'Nicolas Tournadre & Sangda Dorje',
    url: 'https://www.shambhala.com/manual-of-standard-tibetan.html',
    kind: 'book',
    register: 'colloquial',
    cost: 'paid',
    levels: [1, 2, 3, 4],
    note: 'The standard textbook for spoken Lhasa Tibetan, and the one to start with if you want to talk to people rather than read texts. Comes with audio, which matters more than any written pronunciation guide.',
    checked: CHECKED,
  },
  {
    id: 'tournadre-audio',
    title: 'Manual of Standard Tibetan — audio tracks',
    by: 'Shambhala Publications',
    url: 'https://www.shambhala.com/manualofstandardtibetan/',
    kind: 'tool',
    register: 'colloquial',
    cost: 'free',
    levels: [1, 2, 3, 4],
    note: 'The recordings that came with the book on CD, now free online. Useful even without the book: hearing the phrases is the part a page cannot give you.',
    checked: CHECKED,
  },

  // ── Video ────────────────────────────────────────────────────────────────
  {
    id: 'ispeaktibetan',
    title: 'iSpeak Tibetan',
    by: 'YouTube channel',
    url: 'https://www.youtube.com/user/ispeaktibetan',
    kind: 'video',
    register: 'colloquial',
    cost: 'free',
    levels: [1, 2, 3],
    note: 'Short spoken-Tibetan videos, easy to fit into a day. Good for building an ear for the language early, when reading is still slow.',
    checked: CHECKED,
  },
  {
    id: 'sambhota-tutorial',
    title: 'Sambhota Tibetan Language Tutorial',
    by: 'Sambhota Tibetan Schools Society',
    url: 'https://www.youtube.com/playlist?list=PLKXUAmkD36-KSQrfPXya1ixKLidl8zxUB',
    kind: 'video',
    register: 'both',
    cost: 'free',
    levels: [1, 2],
    note: 'A structured beginner series from the Tibetan schools network, starting at the alphabet. Follows a syllabus rather than jumping around, which suits absolute beginners.',
    checked: CHECKED,
  },
  {
    id: 'sambhota-schools',
    title: 'Sambhota Schools',
    by: 'Sambhota Tibetan Schools Society',
    url: 'https://www.youtube.com/channel/UCVz-BSts_R8UHctisBkqRfA',
    kind: 'video',
    register: 'both',
    cost: 'free',
    levels: [1, 2, 3],
    note: 'The wider channel behind the tutorial series, with school lessons and cultural material alongside the language teaching.',
    checked: CHECKED,
  },

  // ── Courses & teachers ───────────────────────────────────────────────────
  {
    id: 'tibetanlanguage-school',
    title: 'tibetanlanguage.school',
    by: 'Independent teacher',
    url: 'https://tibetanlanguage.school/',
    kind: 'course',
    register: 'both',
    cost: 'mixed',
    levels: [1, 2, 3],
    note: 'Ten free self-paced units covering Standard Tibetan, with listening and reading practice, plus paid live classes if you want a teacher. A good next step once the alphabet is comfortable.',
    checked: CHECKED,
  },
  {
    id: 'esukhia',
    title: 'Esukhia',
    by: 'Esukhia (Dharamsala)',
    url: 'https://esukhia.net/',
    kind: 'course',
    register: 'both',
    cost: 'mixed',
    levels: [2, 3, 4, 5],
    note: 'A Dharamsala non-profit long known for pairing learners with native-speaker tutors, now also running the Sherab e-learning platform. Worth contacting directly, as what they offer has shifted over time.',
    checked: CHECKED,
  },
  {
    id: 'classcentral-tibetan',
    title: 'Tibetan courses index',
    by: 'Class Central',
    url: 'https://www.classcentral.com/subject/tibetan',
    kind: 'course',
    register: 'both',
    cost: 'mixed',
    levels: [1, 2, 3, 4, 5],
    note: 'An aggregator of Tibetan courses across platforms, with free options filtered out easily. Useful for finding something structured when you want a syllabus and deadlines.',
    checked: CHECKED,
  },

  // ── Tools & dictionaries ─────────────────────────────────────────────────
  {
    id: 'monlam-ai',
    title: 'Monlam AI',
    by: 'Monlam Tibetan IT Research Centre',
    url: 'https://monlam.ai/',
    kind: 'tool',
    register: 'both',
    cost: 'free',
    levels: [1, 2, 3, 4, 5],
    note: 'Translation, speech-to-text and OCR for Tibetan, from the team behind the Monlam Grand Dictionary. MunSel is built on these same models, so what you see here is what powers the tutor.',
    checked: CHECKED,
  },
  {
    id: 'thlib',
    title: 'Tibetan and Himalayan Library',
    by: 'University of Virginia',
    url: 'https://thlib.org/',
    kind: 'tool',
    register: 'both',
    cost: 'free',
    levels: [2, 3, 4, 5],
    note: 'Open-access dictionaries with pronunciation and multimedia, plus transliteration tools and text collections. The transliteration converter alone is worth bookmarking when Wylie and script stop lining up in your head.',
    checked: CHECKED,
  },
  {
    id: 'rywiki',
    title: 'Rangjung Yeshe Wiki — Dharma Dictionary',
    by: 'Tsadra Foundation',
    url: 'https://rywiki.tsadra.org/',
    kind: 'tool',
    register: 'literary',
    cost: 'free',
    levels: [3, 4, 5],
    note: 'A large Tibetan–English dictionary wiki, strongest on Buddhist and literary vocabulary. Reach for it when a word is missing from everyday dictionaries — and expect literary senses, not conversation.',
    checked: CHECKED,
  },
  {
    id: 'lotsawa-house',
    title: 'Lotsawa House',
    by: 'Lotsawa House',
    url: 'https://www.lotsawahouse.org/',
    kind: 'tool',
    register: 'literary',
    cost: 'free',
    levels: [4, 5],
    note: 'Thousands of Tibetan Buddhist texts with translations side by side, free to download. Built for practitioners rather than learners, but reading a text next to its translation is real practice once you can decode script.',
    checked: CHECKED,
  },
  {
    id: 'learntibetanlanguage',
    title: 'Learn Tibetan! — resource directory',
    by: 'Andrew Hughes',
    url: 'https://learntibetanlanguage.org/',
    kind: 'tool',
    register: 'both',
    cost: 'free',
    levels: [1, 2, 3, 4, 5],
    note: 'A hand-maintained directory of Tibetan learning material — textbooks, teachers, channels and dictionaries. The place to go when you have outgrown this page and want the long list.',
    checked: CHECKED,
  },
];

export const KIND_LABELS: Record<ResourceKind, string> = {
  book: 'Books',
  video: 'Video',
  course: 'Courses & teachers',
  tool: 'Tools & dictionaries',
};

/** Order sections deliberately: how most people actually start. */
export const KIND_ORDER: ResourceKind[] = ['course', 'video', 'book', 'tool'];

export const REGISTER_LABELS: Record<Register, string> = {
  colloquial: 'Spoken',
  literary: 'Literary',
  both: 'Both',
};
