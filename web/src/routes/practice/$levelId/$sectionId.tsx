import type { ReactElement } from 'react'
import { Link, Navigate, createFileRoute, redirect } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { getLevel, getSection, isLevelUnlocked } from '@/lib/curriculum'
import { useAuth } from '@/features/auth/AuthContext'
import { PracticeView } from '@/features/practice/PracticeView'
import { Section3View } from '@/features/practice/Section3View'
import { PunctuationView } from '@/features/practice/level1/PunctuationView'
import { NumeralsView } from '@/features/practice/level1/NumeralsView'
import { QuestionWordsView } from '@/features/practice/level2/QuestionWordsView'
import { VerbsView } from '@/features/practice/level2/VerbsView'
import { NumbersView } from '@/features/practice/level2/NumbersView'

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
  '2.2': () => <QuestionWordsView />,
  '2.3': () => <VerbsView />,
  '2.4': () => <NumbersView />,
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

  if (!isLevelUnlocked(level.id, user?.level)) {
    return <Navigate to="/practice" replace />
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-4 pt-3 pb-1 max-w-lg mx-auto w-full">
        <Link
          to="/practice/$levelId"
          params={{ levelId }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {level.title}
        </Link>
        <p className="text-xs text-muted-foreground mt-1">
          Level {level.id} · {section.title}
        </p>
      </div>

      <View />
    </div>
  )
}
