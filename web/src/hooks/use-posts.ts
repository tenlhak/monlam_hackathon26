import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type Post = {
  id: number
  title: string
  body: string
  userId: number
}

async function fetchPosts() {
  const { data } = await api.get<Post[]>('/posts', {
    params: { _limit: 3 },
  })
  return data
}

export function usePosts() {
  return useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  })
}
