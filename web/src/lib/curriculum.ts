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
        itemCount: 0,
        drills: [],
        available: false,
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
        itemCount: 0,
        drills: [],
        available: false,
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
    sections: [],
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
    sections: [],
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
    sections: [],
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

export function getSection(
  levelId: number,
  sectionId: number,
): CurriculumSection | undefined {
  return getLevel(levelId)?.sections.find((s) => s.id === sectionId);
}
