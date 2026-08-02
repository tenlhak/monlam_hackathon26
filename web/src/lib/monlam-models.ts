import { useSyncExternalStore } from 'react'

/**
 * Which Monlam AI model is answering right now.
 *
 * Every drill in Practice is really a call to one of four Monlam models, but
 * from inside a drill that is invisible — audio just plays, a recording is just
 * "checked". This tracks the calls as they happen so the UI can name the model
 * doing the work.
 *
 * Activity is recorded at the network layer (see the interceptor in api.ts)
 * rather than at each button, so a new drill is covered the moment it calls an
 * endpoint — there is no per-view list to keep in sync.
 */

export type ModelId = 'tts' | 'stt' | 'ocr' | 'chat'

export interface MonlamModel {
  id: ModelId
  /** Shown on the chip */
  label: string
  /** What it is doing, shown while the call is in flight */
  busy: string
  /** Plain-language explanation, used as the chip's tooltip */
  what: string
}

export const MONLAM_MODELS: Record<ModelId, MonlamModel> = {
  tts: {
    id: 'tts',
    label: 'Monlam TTS',
    busy: 'Speaking…',
    what: 'Text-to-speech — turns the Tibetan on screen into audio.',
  },
  stt: {
    id: 'stt',
    label: 'Monlam STT',
    busy: 'Listening…',
    what: 'Speech-to-text — transcribes your recording so it can be checked.',
  },
  ocr: {
    id: 'ocr',
    label: 'Monlam OCR',
    busy: 'Reading…',
    what: 'Optical character recognition — reads the letter you traced.',
  },
  chat: {
    id: 'chat',
    label: 'Monlam Melong',
    busy: 'Thinking…',
    what: 'The chat model answering your questions.',
  },
}

/** Which endpoint belongs to which model. Prefix match, longest first. */
const ROUTES: [string, ModelId][] = [
  ['/api/practice/listen', 'tts'],
  ['/api/practice/speak', 'stt'],
  ['/api/practice/trace', 'ocr'],
  ['/api/chat', 'chat'],
]

export function modelForUrl(url: string | undefined): ModelId | null {
  if (!url) return null
  return ROUTES.find(([prefix]) => url.startsWith(prefix))?.[1] ?? null
}

interface ModelState {
  /** Calls currently in flight — a count, since drills can overlap */
  inFlight: number
  /** Has this model been used at all since the last reset */
  used: boolean
}

const listeners = new Set<() => void>()
let state: Record<ModelId, ModelState> = blank()
let snapshot = computeSnapshot()

function blank(): Record<ModelId, ModelState> {
  return {
    tts: { inFlight: 0, used: false },
    stt: { inFlight: 0, used: false },
    ocr: { inFlight: 0, used: false },
    chat: { inFlight: 0, used: false },
  }
}

export interface ModelActivity {
  model: MonlamModel
  active: boolean
}

/**
 * The models worth showing: any that is running or has run. `useSyncExternalStore`
 * compares by reference, so the array is rebuilt only when something changed.
 */
function computeSnapshot(): ModelActivity[] {
  return (Object.keys(state) as ModelId[])
    .filter((id) => state[id].used || state[id].inFlight > 0)
    .map((id) => ({ model: MONLAM_MODELS[id], active: state[id].inFlight > 0 }))
}

function emit() {
  snapshot = computeSnapshot()
  listeners.forEach((l) => l())
}

/** Marks a model busy. Call the returned function when the request settles. */
export function beginModelCall(id: ModelId): () => void {
  state = { ...state, [id]: { inFlight: state[id].inFlight + 1, used: true } }
  emit()

  let released = false
  return () => {
    if (released) return
    released = true
    state = {
      ...state,
      [id]: { ...state[id], inFlight: Math.max(0, state[id].inFlight - 1) },
    }
    emit()
  }
}

/** Clears the history — called when the learner moves to another section. */
export function resetModelActivity() {
  const anyUsed = (Object.keys(state) as ModelId[]).some((id) => state[id].used)
  if (!anyUsed) return
  state = blank()
  emit()
}

export function useModelActivity(): ModelActivity[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
  )
}
