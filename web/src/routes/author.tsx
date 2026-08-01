import { createFileRoute } from '@tanstack/react-router'
import { StrokeAuthor } from '@/features/authoring/StrokeAuthor'

export const Route = createFileRoute('/author')({
  component: AuthorPage,
})

function AuthorPage() {
  return <StrokeAuthor />
}
