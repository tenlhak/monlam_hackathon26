import { useEffect, type ReactElement } from 'react'
import { Link, Navigate, createFileRoute, redirect } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { getLevel, getSection, isLevelUnlocked, shortTitle } from '@/lib/curriculum'
import { useAuth } from '@/features/auth/AuthContext'
import { useSectionProgress } from '@/lib/progress'
import { resetModelActivity } from '@/lib/monlam-models'
import { ModelActivityBar } from '@/components/ModelActivityBar'
import { cn } from '@/lib/utils'
import { PracticeView } from '@/features/practice/PracticeView'
import { Section3View } from '@/features/practice/Section3View'
import { PunctuationView } from '@/features/practice/level1/PunctuationView'
import { NumeralsView } from '@/features/practice/level1/NumeralsView'
import { ThemedVocabularyView } from '@/features/practice/level2/ThemedVocabularyView'
import { QuestionWordsView } from '@/features/practice/level2/QuestionWordsView'
import { VerbsView } from '@/features/practice/level2/VerbsView'
import { NumbersView } from '@/features/practice/level2/NumbersView'
import { SimpleDialoguesView } from '@/features/practice/level2/SimpleDialoguesView'
import { EightCasesView } from '@/features/practice/level3/EightCasesView'

/**
 * Which view runs a given section, keyed `level.section`.
 *
 * A section marked `available` in curriculum.ts but missing here would be a
 * dead link, so `beforeLoad` treats absence from this map as "not built yet"
 * and sends the learner back to the section picker.
 */
const SECTION_VIEWS: Record<string, () => ReactElement> = {
  '1.1': () => <PracticeView section={1} />,
  '1.2': () => <PracticeView section={2} />,
  '1.3': () => <Section3View />,
  '1.4': () => <PunctuationView />,
  '1.5': () => <NumeralsView />,
  '2.1': () => <ThemedVocabularyView />,
  '2.2': () => <QuestionWordsView />,
  '2.3': () => <VerbsView />,
  '2.4': () => <NumbersView />,
  '2.5': () => <SimpleDialoguesView />,
  '3.1': () => <EightCasesView />,
}

export const Route = createFileRoute('/practice/$levelId/$sectionId')({
  beforeLoad: ({ params }) => {
    const levelId = Number(params.levelId)
    const sectionId = Number(params.sectionId)
    const level = getLevel(levelId)
    const section = getSection(levelId, sectionId)

    if (!level || !section?.available) {
      throw redirect({ to: '/practice' })
    }

    if (!SECTION_VIEWS[`${levelId}.${sectionId}`]) {
      throw redirect({
        to: '/practice/$levelId',
        params: { levelId: String(levelId) },
      })
    }
  },
  component: PracticeDrillPage,
})

function PracticeDrillPage() {
  const { levelId, sectionId } = Route.useParams()
  const { user } = useAuth()
  const level = getLevel(Number(levelId))!
  const section = getSection(Number(levelId), Number(sectionId))!
  const View = SECTION_VIEWS[`${Number(levelId)}.${Number(sectionId)}`]
  const progress = useSectionProgress(Number(levelId), Number(sectionId))

  // The model chips report what this section has called, so they start empty
  // when the learner opens a different one.
  useEffect(() => resetModelActivity(), [levelId, sectionId])

  // Same placement gate as /practice — the home page's Start/Continue card
  // links straight here, skipping the /practice index where this is normally caught.
  if (user && !user.placed_at) {
    return <Navigate to="/placement" replace />
  }

  if (!isLevelUnlocked(level.id, user?.level)) {
    return <Navigate to="/practice" replace />
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* The one place a section names itself. Views below render their drills
          only — repeating the title and focus line inside each of them cost
          three lines at the top of every section for no new information. */}
      <div className="shrink-0 px-4 pt-3 pb-2 max-w-lg mx-auto w-full">
        <Link
          to="/practice/$levelId"
          params={{ levelId }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Level {level.id} · {level.title}
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-lg font-extrabold tracking-tight mt-0.5 truncate">
            {shortTitle(section.title)}
          </h1>
          {progress.total > 0 && (
            <span className="ml-auto shrink-0 text-xs font-heading font-bold tabular-nums text-muted-foreground">
              {progress.complete ? 'Complete 🎉' : `${progress.done}/${progress.total}`}
            </span>
          )}
        </div>

        {/* Shared by every section — it used to live inside PracticeView, so
            only the two letter drills showed the learner how far along they
            were. */}
        {progress.total > 0 && (
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1.5">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                progress.complete
                  ? 'bg-gradient-to-r from-sunrise to-sun'
                  : 'bg-primary',
              )}
              style={{
                width: `${Math.max(progress.percent, progress.done > 0 ? 3 : 0)}%`,
              }}
            />
          </div>
        )}

        <ModelActivityBar className="mt-2" />
      </div>

      <View />
    </div>
  )
}
