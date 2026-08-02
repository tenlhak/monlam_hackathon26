/**
 * Curriculum hierarchy for Practice:
 *   Level → Sections → Drill items (loaded per section)
 *
 * Five levels, roughly mapped to CEFR. Level 1 is live; the rest are described
 * in full but locked, so the picker shows the whole path without pretending
 * content exists behind it.
 */

/** Accent used for a level's number, title and capability chip. */
export type LevelTone = "indigo" | "green" | "amber" | "violet";

export interface CurriculumSection {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  /** Number of practice items (approx) shown in the picker */
  itemCount: number;
  /**
   * The drill tabs this section actually opens with, in order. Must match the
   * section's view — the picker advertises these to the learner. Empty for
   * sections that are not built yet.
   */
  drills: string[];
  available: boolean;
}

export interface CurriculumLevel {
  id: number;
  title: string;
  /** Approximate CEFR band, shown beside the title */
  cefr: string;
  /** One short line — used on the section picker */
  focus: string;
  /** Full description — used on the level cards */
  summary: string;
  /** Which Monlam models the level leans on; rendered as the tinted chip */
  capability: string;
  /** Secondary chips: pedagogy and rough hours, or the specialist tracks */
  meta: string[];
  tone: LevelTone;
  available: boolean;
  sections: CurriculumSection[];
}

export const CURRICULUM: CurriculumLevel[] = [
  {
    id: 1,
    title: "Script foundation",
    cefr: "pre-A1",
    focus: "Letters, vowels and syllable structure — the building blocks.",
    summary:
      "30 consonants, 4 vowels, syllable architecture, punctuation, numerals.",
    capability: "TTS · STT",
    meta: ["Trace · Builder"],
    tone: "indigo",
    available: true,
    sections: [
      {
        id: 1,
        slug: "consonants",
        title: "Section 1 — The 30 consonants",
        subtitle: "Traditional order — recognise and sound out each letter.",
        itemCount: 34,
        drills: ["Listen", "Trace", "Speak", "Build"],
        available: true,
      },
      {
        id: 2,
        slug: "vowels",
        title: "Section 2 — The 4 vowels",
        subtitle: "Combine vowel marks with root consonants: ka + i/u/e/o.",
        itemCount: 32,
        drills: ["Listen", "Trace", "Speak", "Build"],
        available: true,
      },
      {
        id: 3,
        slug: "syllable-architecture",
        title: "Section 3 — Syllable architecture",
        subtitle:
          "Prefix, root, vowel, suffix, post-suffix — five letters, one sound.",
        itemCount: 6,
        drills: ["Anatomy", "Builder", "Quiz"],
        available: true,
      },
      {
        id: 4,
        slug: "punctuation",
        title: "Section 4 — Punctuation",
        subtitle:
          "Tsheg and shad — how a line breaks into syllables and clauses.",
        itemCount: 8,
        drills: ["Marks", "In context", "Quiz"],
        available: true,
      },
      {
        id: 5,
        slug: "numerals",
        title: "Section 5 — Numerals",
        subtitle: "The ten digits ༠–༩ — recognise them and read them off a page.",
        itemCount: 10,
        drills: ["Digits", "Match", "Read"],
        available: true,
      },
    ],
  },
  {
    id: 2,
    title: "Functional beginner",
    cefr: "A1–A2",
    focus: "Survival vocabulary, greetings and first sentences.",
    summary:
      "Survival vocabulary, greetings, numbers, family. First sentences with ཡིན / རེད / ཡོད / འདུག.",
    capability: "TTS · STT · MT gloss",
    meta: ["Spaced rep"],
    tone: "indigo",
    available: true,
    sections: [
      {
        id: 1,
        slug: "themed-vocabulary",
        title: "Section 1 — Expanded vocabulary",
        subtitle:
          "Daily routine, transport, shopping, weather, body, time expressions.",
        itemCount: 30,
        drills: ["Learn", "Quiz", "Speak"],
        available: true,
      },
      {
        id: 2,
        slug: "question-forms",
        title: "Section 2 — Question forms",
        subtitle:
          "ག་རེ · སུ · གང་དུ · ནམ · ཅི་ཕྱིར · ཇི་ལྟར — and the gaps they fill.",
        itemCount: 6,
        drills: ["Learn", "Gap-fill", "Speak"],
        available: true,
      },
      {
        id: 3,
        slug: "verb-basics",
        title: "Section 3 — Verb basics",
        subtitle:
          "Present and past stems for seven core verbs, with irregulars flagged.",
        itemCount: 7,
        drills: ["Stems", "Quiz"],
        available: true,
      },
      {
        id: 4,
        slug: "numbers-in-speech",
        title: "Section 4 — Numbers in speech",
        subtitle:
          "Digits ༠–༩ and tens — hear a number and write it, or read one aloud.",
        itemCount: 20,
        drills: ["Digits", "Hear → write", "Read aloud"],
        available: true,
      },
      {
        id: 5,
        slug: "simple-dialogues",
        title: "Section 5 — Simple dialogues",
        subtitle:
          "4–6 exchanges: introductions, ordering food, directions, shopping.",
        itemCount: 16,
        drills: ["Read", "Speak"],
        available: true,
      },
    ],
  },
  {
    id: 3,
    title: "Independent user",
    cefr: "B1",
    focus: "Cases, verb stems, evidentiality and cursive recognition.",
    summary:
      "8 cases, verb stems, evidentiality in depth, honorific register intro, umé cursive recognition.",
    capability: "TTS · STT · OCR · MT",
    meta: ["Role-play"],
    tone: "green",
    available: false,
    sections: [
      {
        id: 1,
        slug: "eight-cases",
        title: "Section 1 — The eight cases (རྣམ་དབྱེ་བརྒྱད)",
        subtitle:
          "Genitive, agentive, la-don, ablative + 4 others — particle choice is driven by the preceding suffix.",
        itemCount: 0,
        drills: [],
        available: false,
      },
      {
        id: 2,
        slug: "verb-stems",
        title: "Section 2 — Verb stems",
        subtitle:
          "Present, past, future, imperative — the 4-stem system, and where modern verbs have collapsed stems.",
        itemCount: 0,
        drills: [],
        available: false,
      },
      {
        id: 3,
        slug: "evidentiality",
        title: "Section 3 — Evidentiality and egophoricity",
        subtitle:
          "ཡོད vs འདུག vs ཡོད་རེད · སོང vs བྱུང vs ཤག — where intermediate learners plateau. Taken in depth.",
        itemCount: 0,
        drills: [],
        available: false,
      },
      {
        id: 4,
        slug: "honorific-intro",
        title: "Section 4 — Honorific register introduction (ཞེ་ས)",
        subtitle:
          "Ordinary vs. first-level honorific vocabulary (ལག་པ → ཕྱག) — recognition first, production second.",
        itemCount: 0,
        drills: [],
        available: false,
      },
      {
        id: 5,
        slug: "connected-listening",
        title: "Section 5 — Connected listening",
        subtitle:
          "Dialogues at natural speed, news register, numbers in speech, adjustable playback.",
        itemCount: 0,
        drills: [],
        available: false,
      },
      {
        id: 6,
        slug: "wild-capture",
        title: "Section 6 — Wild capture (OCR + MT)",
        subtitle:
          "Photograph a real sign, menu or page — OCR extracts it, tap a syllable for a dictionary lookup and MT gloss.",
        itemCount: 0,
        drills: [],
        available: false,
      },
      {
        id: 7,
        slug: "role-play",
        title: "Section 7 — Role-play dialogues",
        subtitle:
          "A shopkeeper, official or doctor speaks via TTS — reply by voice or in writing. Graded on grammar targets, not meaning.",
        itemCount: 0,
        drills: [],
        available: false,
      },
    ],
  },
  {
    id: 4,
    title: "Advanced communicator",
    cefr: "B2",
    focus: "Honorifics, composition and pecha literacy.",
    summary:
      "Full honorific system, composition, connected listening at natural speed, pecha literacy, umé reading fluency.",
    capability: "MT post-edit · OCR · STT",
    meta: ["Pecha reader"],
    tone: "amber",
    available: false,
    sections: [
      {
        id: 1,
        slug: "full-honorific-system",
        title: "Section 1 — Full honorific system",
        subtitle:
          "All registers, including very high honorific — paired sentence drills across registers.",
        itemCount: 0,
        drills: [],
        available: false,
      },
      {
        id: 2,
        slug: "formal-composition",
        title: "Section 2 — Formal composition",
        subtitle:
          "Letters, essays, reports, narrative — Tibetan paragraph structure differs from English.",
        itemCount: 0,
        drills: [],
        available: false,
      },
      {
        id: 3,
        slug: "native-speed-listening",
        title: "Section 3 — Connected listening at native speed",
        subtitle: "Podcasts, speeches, news — STT plus timing analysis.",
        itemCount: 0,
        drills: [],
        available: false,
      },
      {
        id: 4,
        slug: "pecha-and-cursive",
        title: "Section 4 — Pecha literacy and cursive reading (དཔེ་ཆ + དབུ་མེད)",
        subtitle:
          "ཚུགས་ཐུང then འཁྱུག་ཡིག, traditional page format, abbreviations, and OCR-aligned pecha scans.",
        itemCount: 0,
        drills: [],
        available: false,
      },
      {
        id: 5,
        slug: "mt-post-editing",
        title: "Section 5 — MT post-editing",
        subtitle:
          "Critique and correct a raw MT translation, then diff your version against a human reference.",
        itemCount: 0,
        drills: [],
        available: false,
      },
      {
        id: 6,
        slug: "interpretation-drill",
        title: "Section 6 — Interpretation drill",
        subtitle:
          "Audio plays, you interpret aloud — STT captures it and scores latency alongside accuracy.",
        itemCount: 0,
        drills: [],
        available: false,
      },
    ],
  },
  {
    id: 5,
    title: "Specialist tracks",
    cefr: "C1–C2",
    focus: "Four specialist paths — genuinely different destinations.",
    summary:
      "Specialist paths to choose from: Classical/literary, Dharma/philosophical, Professional/modern, Dialect studies.",
    capability: "All 4 models",
    meta: ["Classical", "Dharma", "Professional", "Dialect"],
    tone: "violet",
    available: false,
    sections: [
      {
        id: 1,
        slug: "classical-literary",
        title: "Track A — Classical / literary (ཆོས་སྐད)",
        subtitle:
          "7- and 9-syllable verse metre, classical particle usage, metre/pause analysis via STT, recitation drills.",
        itemCount: 0,
        drills: [],
        available: false,
      },
      {
        id: 2,
        slug: "dharma-philosophical",
        title: "Track B — Dharma / philosophical",
        subtitle:
          "Madhyamaka, Pramāṇa, Abhidharma vocabulary, debate language (རྟགས་གསལ), layered-annotation text reading.",
        itemCount: 0,
        drills: [],
        available: false,
      },
      {
        id: 3,
        slug: "professional-modern",
        title: "Track C — Professional / modern",
        subtitle:
          "Neologisms, Sowa Rigpa medical terms, legal/administrative register, journalism, formal correspondence.",
        itemCount: 0,
        drills: [],
        available: false,
      },
      {
        id: 4,
        slug: "dialect-studies",
        title: "Track D — Dialect studies",
        subtitle:
          "Amdo, Kham, Ü-Tsang comparison and phonology. STT is Lhasa-trained — Amdo/Kham pronunciation scores differently; target dialect is stated per drill.",
        itemCount: 0,
        drills: [],
        available: false,
      },
    ],
  },
];

export function getLevel(levelId: number): CurriculumLevel | undefined {
  return CURRICULUM.find((l) => l.id === levelId);
}

/**
 * Whether a learner has reached a level. Placement unlocks everything up to
 * and including their level — Level 2 means Levels 1 and 2.
 *
 * `available` on the level is a separate axis: it says whether we have built
 * anything there yet. A learner placed at Level 4 unlocks Levels 3 and 4 and
 * finds them empty; that is honest about their placement rather than capping
 * it to our build progress.
 */
export function isLevelUnlocked(
  levelId: number,
  userLevel: number | undefined,
): boolean {
  return levelId <= (userLevel ?? 1);
}

/**
 * Whether a level has drills a learner can actually open.
 *
 * `sections.length > 0` is not the test: Levels 3–5 describe their sections in
 * full so the picker can show the whole path, but every one of them is
 * `available: false` with `itemCount: 0`. Counting those as content sends a
 * learner placed high to a level with nothing in it and a 0-of-0 progress bar.
 */
export function hasBuiltContent(levelId: number): boolean {
  return (getLevel(levelId)?.sections ?? []).some((s) => s.available);
}

export function getSection(
  levelId: number,
  sectionId: number,
): CurriculumSection | undefined {
  return getLevel(levelId)?.sections.find((s) => s.id === sectionId);
}
