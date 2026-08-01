export interface User {
  id: number
  name: string
  /** Highest unlocked level, 1–5. Set by the placement quiz, never lowered. */
  level: number
  created_at: string
  /**
   * When the placement quiz was last completed ("YYYY-MM-DD HH:MM:SS" from
   * SQLite), or null if never placed. Null is what triggers the quiz.
   */
  placed_at: string | null
  stats?: {
    attempts: number
    correct: number
    weakest: { target: string; misses: number }[]
  }
}

export interface Conversation {
  id: number
  user_id: number
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface PracticeItem {
  text: string
  roman: string
  gloss: string
}

/** Discriminated union so drill components can narrow per section */
export type ActiveSection = 1 | 2

export interface PracticeLevel {
  level: number
  title: string
  focus: string
  items: PracticeItem[]
}

export type ChatSSEEvent =
  | { type: 'delta'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
