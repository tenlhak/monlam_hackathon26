export interface User {
  id: number
  name: string
  level: number
  created_at: string
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
