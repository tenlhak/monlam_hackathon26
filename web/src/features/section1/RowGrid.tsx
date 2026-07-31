import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { Consonant, ConsonantRow } from '@/data/consonants'

type LetterStatus = 'done' | 'active' | 'locked' | 'upcoming'

type RowGridProps = {
  row: ConsonantRow
  rowIndex: number
  totalRows: number
  activeLetterId: string
  completedIds: Set<string>
  onSelectLetter: (letter: Consonant) => void
}

function statusFor(
  letter: Consonant,
  index: number,
  activeLetterId: string,
  completedIds: Set<string>,
  letters: Consonant[],
): LetterStatus {
  if (completedIds.has(letter.id)) return 'done'
  if (letter.id === activeLetterId) return 'active'

  const firstIncomplete = letters.findIndex((l) => !completedIds.has(l.id))
  if (index > firstIncomplete && firstIncomplete !== -1) return 'locked'
  return 'upcoming'
}

export function RowGrid({
  row,
  rowIndex,
  totalRows,
  activeLetterId,
  completedIds,
  onSelectLetter,
}: RowGridProps) {
  const doneCount = row.letters.filter((l) => completedIds.has(l.id)).length
  const progress = (doneCount / row.letters.length) * 100

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Row {rowIndex + 1} of {totalRows} · {row.label}
      </p>

      <div
        className={cn(
          'mt-5 grid flex-1 gap-3',
          row.letters.length === 2 ? 'grid-cols-2' : 'grid-cols-4',
        )}
      >
        {row.letters.map((letter, index) => {
          const status = statusFor(
            letter,
            index,
            activeLetterId,
            completedIds,
            row.letters,
          )
          const selectable = status === 'done' || status === 'active'

          return (
            <button
              key={letter.id}
              type="button"
              disabled={!selectable && status === 'locked'}
              onClick={() => {
                if (selectable || status === 'upcoming') onSelectLetter(letter)
              }}
              className={cn(
                'font-tibetan flex aspect-[3/4] items-center justify-center rounded-xl border text-4xl transition-all sm:text-5xl',
                status === 'done' &&
                  'border-transparent bg-[oklch(0.94_0.05_150)] text-foreground',
                status === 'active' &&
                  'border-[oklch(0.65_0.12_295)] bg-[oklch(0.96_0.03_295)] text-foreground shadow-[0_0_0_3px_oklch(0.88_0.05_295)]',
                status === 'upcoming' &&
                  'border-border/70 bg-background text-foreground/80',
                status === 'locked' &&
                  'cursor-not-allowed border-transparent bg-muted/50 text-muted-foreground/40',
              )}
              aria-label={`${letter.latin} (${letter.glyph}) — ${status}`}
              aria-current={status === 'active' ? 'true' : undefined}
            >
              {letter.glyph}
            </button>
          )
        })}
      </div>

      <div className="mt-5 space-y-2">
        <Progress
          value={progress}
          className="h-1.5 bg-[oklch(0.93_0.01_295)] **:data-[slot=progress-indicator]:bg-[oklch(0.62_0.14_295)]"
        />
        <p className="text-sm text-muted-foreground">
          {doneCount} of {row.letters.length} done this row
        </p>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Locking the grid by row prevents skipping. Model pills show which model
        is active per stage.
      </p>
    </div>
  )
}
