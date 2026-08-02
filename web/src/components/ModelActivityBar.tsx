import { Mic, ScanText, Sparkles, Volume2 } from 'lucide-react'
import { useModelActivity, type ModelId } from '@/lib/monlam-models'
import { cn } from '@/lib/utils'

const ICONS: Record<ModelId, typeof Volume2> = {
  tts: Volume2,
  stt: Mic,
  ocr: ScanText,
  chat: Sparkles,
}

/**
 * Names the Monlam model behind whatever just happened.
 *
 * Chips appear only once a model has actually been called, and light up while
 * a call is in flight — so the row is always an accurate account of this
 * session rather than a claim about what a screen might use.
 */
export function ModelActivityBar({ className }: { className?: string }) {
  const activity = useModelActivity()
  if (activity.length === 0) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {activity.map(({ model, active }) => {
        const Icon = ICONS[model.id]
        return (
          <span
            key={model.id}
            title={model.what}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
              active
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground',
            )}
          >
            <Icon className={cn('h-3 w-3', active && 'animate-pulse')} />
            {active ? model.busy : model.label}
          </span>
        )
      })}
    </div>
  )
}
