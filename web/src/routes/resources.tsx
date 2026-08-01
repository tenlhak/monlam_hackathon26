import { createFileRoute } from '@tanstack/react-router'
import { ResourcesView } from '@/features/resources/ResourcesView'

export const Route = createFileRoute('/resources')({
  component: ResourcesPage,
})

function ResourcesPage() {
  return <ResourcesView />
}
