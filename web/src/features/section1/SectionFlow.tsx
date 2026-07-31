import { cn } from '@/lib/utils'

const STEPS = [
  { label: 'Open row', tone: 'neutral' },
  { label: 'Hear (TTS)', tone: 'tts' },
  { label: 'Trace', tone: 'neutral' },
  { label: 'Speak (STT)', tone: 'stt' },
  { label: 'Row quiz', tone: 'neutral' },
  { label: 'Unlock next row', tone: 'neutral' },
] as const

export function SectionFlow() {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Full section flow
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center gap-2">
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium',
                step.tone === 'tts' &&
                  'bg-[oklch(0.9_0.05_295)] text-[oklch(0.38_0.1_295)]',
                step.tone === 'stt' &&
                  'bg-[oklch(0.92_0.06_150)] text-[oklch(0.35_0.1_150)]',
                step.tone === 'neutral' && 'bg-muted text-muted-foreground',
              )}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="text-muted-foreground/50" aria-hidden>
                →
              </span>
            )}
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        STT decoder is constrained to the 30-consonant set, not open
        transcription. Confidence shown as a bar with runner-up, not pass/fail.
      </p>
    </div>
  )
}
