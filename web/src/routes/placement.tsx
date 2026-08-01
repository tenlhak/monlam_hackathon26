import { createFileRoute } from '@tanstack/react-router'
import { PlacementQuiz } from '@/features/placement/PlacementQuiz'

export const Route = createFileRoute('/placement')({
  component: PlacementPage,
})

function PlacementPage() {
  return <PlacementQuiz />
}
