/**
 * Curriculum hierarchy for Practice:
 *   Level → Sections → Drill items (loaded per section)
 *
 * Level 1 is live. Later levels are stubs for the picker UI.
 */

export interface CurriculumSection {
  id: number
  slug: string
  title: string
  subtitle: string
  /** Number of practice items (approx) shown in the picker */
  itemCount: number
  available: boolean
}

export interface CurriculumLevel {
  id: number
  title: string
  focus: string
  available: boolean
  sections: CurriculumSection[]
}

export const CURRICULUM: CurriculumLevel[] = [
  {
    id: 1,
    title: 'Foundations',
    focus: 'Letters and vowels — the building blocks of Tibetan.',
    available: true,
    sections: [
      {
        id: 1,
        slug: 'consonants',
        title: 'Section 1 — The 30 consonants',
        subtitle: 'Traditional order — recognise and sound out each letter.',
        itemCount: 34,
        available: true,
      },
      {
        id: 2,
        slug: 'vowels',
        title: 'Section 2 — The 4 vowels',
        subtitle: 'Combine vowel marks with root consonants: ཀ → ཀི ཀུ ཀེ ཀོ.',
        itemCount: 32,
        available: true,
      },
    ],
  },
  {
    id: 2,
    title: 'First words',
    focus: 'Short everyday words and greetings.',
    available: false,
    sections: [],
  },
  {
    id: 3,
    title: 'Everyday phrases',
    focus: 'Complete phrases you can use in conversation.',
    available: false,
    sections: [],
  },
]

export function getLevel(levelId: number): CurriculumLevel | undefined {
  return CURRICULUM.find((l) => l.id === levelId)
}

export function getSection(
  levelId: number,
  sectionId: number,
): CurriculumSection | undefined {
  return getLevel(levelId)?.sections.find((s) => s.id === sectionId)
}
