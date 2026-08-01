import { createFileRoute } from '@tanstack/react-router'
import { NewsView } from '@/features/news/NewsView'

export const Route = createFileRoute('/news')({
  component: NewsPage,
})

function NewsPage() {
  return <NewsView />
}
