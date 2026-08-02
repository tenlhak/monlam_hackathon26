import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PanelLeft, MessageSquarePlus } from 'lucide-react'
import type { Conversation, Message } from '@/lib/types/tutor'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { beginModelCall } from '@/lib/monlam-models'
import { ModelActivityBar } from '@/components/ModelActivityBar'
import { ConversationSidebar } from './ConversationSidebar'
import { MessageList } from './MessageList'
import { ChatComposer } from './ChatComposer'

export function ChatView() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const { data: convData } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: () =>
      api
        .get<{ conversations: Conversation[] }>(`/api/conversations?user_id=${user?.id}`)
        .then((r) => r.data),
    enabled: !!user,
  })
  const conversations = convData?.conversations ?? []

  const openConversation = useCallback(async (id: number) => {
    setActiveId(id)
    const res = await api.get<{ messages: Message[] }>(`/api/conversations/${id}/messages`)
    setMessages(res.data.messages)
  }, [])

  const newConversation = useCallback(async () => {
    if (!user) return
    const res = await api.post<Conversation>('/api/conversations', { user_id: user.id })
    setActiveId(res.data.id)
    setMessages([])
    qc.invalidateQueries({ queryKey: ['conversations', user.id] })
  }, [user, qc])

  // Auto-open first conversation once loaded
  useEffect(() => {
    if (!convData) return
    if (conversations.length === 0) {
      newConversation()
    } else if (activeId === null) {
      openConversation(conversations[0].id)
    }
  }, [convData]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text || streaming || activeId === null || !user) return

      const isFirst = messages.length === 0
      setMessages((prev) => [...prev, { role: 'user', content: text }])
      setStreaming(true)
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      let reply = ''
      // Streamed over raw fetch, so the axios interceptor cannot see it — the
      // chat model is marked busy by hand for the length of the stream.
      const releaseModel = beginModelCall('chat')

      try {
        const resp = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            conversation_id: activeId,
            message: text,
          }),
        })

        if (!resp.ok) throw new Error(`Server returned ${resp.status}`)

        const reader = resp.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const payload = line.slice(5).trim()
            if (!payload) continue

            try {
              const event = JSON.parse(payload)
              if (event.type === 'delta') {
                reply += event.content
                setMessages((prev) => {
                  const next = [...prev]
                  next[next.length - 1] = { role: 'assistant', content: reply }
                  return next
                })
              } else if (event.type === 'error') {
                setMessages((prev) => {
                  const next = [...prev]
                  next[next.length - 1] = {
                    role: 'assistant',
                    content: `Error: ${event.message}`,
                  }
                  return next
                })
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }

        if (isFirst) {
          qc.invalidateQueries({ queryKey: ['conversations', user.id] })
        }
      } catch (err) {
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            role: 'assistant',
            content: `Could not reach the tutor: ${err instanceof Error ? err.message : 'Unknown error'}`,
          }
          return next
        })
      } finally {
        releaseModel()
        setStreaming(false)
      }
    },
    [user, activeId, messages.length, streaming, qc],
  )

  const activeTitle = conversations.find((c) => c.id === activeId)?.title ?? 'Chat'

  return (
    <div className="flex h-full min-h-0">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        disableNew={messages.length === 0}
        onOpen={openConversation}
        onNew={newConversation}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-h-0">
        <div className="md:hidden shrink-0 flex items-center gap-2 px-3 h-11 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setMobileSidebarOpen(true)}
            title="Chat history"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <span className="flex-1 min-w-0 truncate text-sm font-medium">{activeTitle}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={newConversation}
            disabled={messages.length === 0}
            title="New chat"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </div>
        <MessageList
          messages={messages}
          streaming={streaming}
          userName={user?.name ?? ''}
          onStarterClick={sendMessage}
        />
        <ModelActivityBar className="justify-center px-4 pb-1" />
        <ChatComposer onSend={sendMessage} disabled={streaming} />
      </div>
    </div>
  )
}
