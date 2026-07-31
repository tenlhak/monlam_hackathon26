import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  CONSONANT_ROWS,
  type Consonant,
  type LessonStage,
} from '@/data/consonants'
import { LetterLesson } from './LetterLesson'
import { RowGrid } from './RowGrid'
import { SectionFlow } from './SectionFlow'

export function Section1Consonants() {
  const [rowIndex, setRowIndex] = useState(0)
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    () => new Set(['ka', 'kha']),
  )
  const [activeLetterId, setActiveLetterId] = useState('ga')
  const [stage, setStage] = useState<LessonStage>('trace')

  const row = CONSONANT_ROWS[rowIndex]
  const activeLetter = useMemo(
    () => row.letters.find((l) => l.id === activeLetterId) ?? row.letters[0],
    [row, activeLetterId],
  )

  function handleSelectLetter(letter: Consonant) {
    const letterIndex = row.letters.findIndex((l) => l.id === letter.id)
    const firstIncomplete = row.letters.findIndex(
      (l) => !completedIds.has(l.id),
    )
    if (letterIndex > firstIncomplete && firstIncomplete !== -1) return

    setActiveLetterId(letter.id)
    setStage(completedIds.has(letter.id) ? 'quiz' : 'listen')
  }

  function handleCompleteLetter() {
    const nextCompleted = new Set(completedIds)
    nextCompleted.add(activeLetter.id)
    setCompletedIds(nextCompleted)

    const currentIdx = row.letters.findIndex((l) => l.id === activeLetter.id)
    const nextInRow = row.letters
      .slice(currentIdx + 1)
      .find((l) => !nextCompleted.has(l.id))

    if (nextInRow) {
      setActiveLetterId(nextInRow.id)
      setStage('listen')
      return
    }

    const rowDone = row.letters.every((l) => nextCompleted.has(l.id))
    if (rowDone && rowIndex < CONSONANT_ROWS.length - 1) {
      const nextRow = CONSONANT_ROWS[rowIndex + 1]
      setRowIndex(rowIndex + 1)
      setActiveLetterId(nextRow.letters[0].id)
      setStage('listen')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="text-muted-foreground">01</span> The 30 consonants
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Taught in 8 traditional rows (སྡེ་ཚན་བརྒྱད།). Learner completes one
            row before unlocking the next.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="rounded-full border-transparent bg-[oklch(0.9_0.05_295)] text-[oklch(0.38_0.1_295)]">
            TTS
          </Badge>
          <Badge className="rounded-full border-transparent bg-[oklch(0.92_0.06_150)] text-[oklch(0.35_0.1_150)]">
            STT
          </Badge>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <div className="order-2 lg:order-1">
          <RowGrid
            row={row}
            rowIndex={rowIndex}
            totalRows={CONSONANT_ROWS.length}
            activeLetterId={activeLetter.id}
            completedIds={completedIds}
            onSelectLetter={handleSelectLetter}
          />
        </div>
        <div className="order-1 lg:order-2">
          <LetterLesson
            letter={activeLetter}
            rowLetters={row.letters}
            stage={stage}
            onStageChange={setStage}
            onCompleteLetter={handleCompleteLetter}
          />
        </div>
      </div>

      <SectionFlow />
    </div>
  )
}
