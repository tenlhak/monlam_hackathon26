import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { getLevel, getSection } from '@/lib/curriculum'
import { PracticeView } from '@/features/practice/PracticeView'
import type { ActiveSection } from '@/lib/types/tutor'

export const Route = createFileRoute('/practice/$levelId/$sectionId')({
  beforeLoad: ({ params }) => {
    const levelId = Number(params.levelId)
    const sectionId = Number(params.sectionId)
    const level = getLevel(levelId)
    const section = getSection(levelId, sectionId)

    if (!level?.available || !section?.available) {
      throw redirect({ to: '/practice' })
    }

    // Only Level 1 sections 1–2 are wired in the UI for now
    if (levelId !== 1 || (sectionId !== 1 && sectionId !== 2)) {
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
  const level = getLevel(Number(levelId))!
  const section = getSection(Number(levelId), Number(sectionId))!
  const activeSection = Number(sectionId) as ActiveSection

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
      <PracticeView section={activeSection} />
    </div>
  )
}
