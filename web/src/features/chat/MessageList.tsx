import { useEffect, useRef } from 'react'
import type { Message } from '@/lib/types/tutor'
import { TibetanText } from '@/lib/tibetan-render'
import { ScrollArea } from '@/components/ui/scroll-area'

const STARTERS = [
  'Teach me the alphabet',
  'How do I greet someone?',
  'Teach me a useful phrase',
  'Quiz me',
]

interface MessageListProps {
  messages: Message[]
  streaming: boolean
  userName: string
  onStarterClick: (text: string) => void
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 h-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  )
}

export function MessageList({ messages, streaming, userName, onStarterClick }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 text-center bg-sky-hero">
        <p className="font-tibetan text-4xl leading-relaxed text-primary">
          བཀྲ་ཤིས་བདེ་ལེགས།
        </p>
        <div>
          <h3 className="font-heading font-extrabold text-2xl">
            Hi {userName}, I'm your personal Tibetan tutor.
          </h3>
          <p className="text-muted-foreground text-sm mt-1.5">What should we learn today?</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center max-w-md">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => onStarterClick(s)}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-heading font-bold text-foreground shadow-sm transition-all hover:border-primary/50 hover:bg-accent hover:-translate-y-0.5 active:scale-95"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-5 p-4 pb-2 max-w-2xl mx-auto w-full">
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user'
          const isStreamingPlaceholder = streaming && i === messages.length - 1 && !isUser && msg.content === ''

          if (isUser) {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5 text-sm leading-relaxed shadow-sm">
                  <p>{msg.content}</p>
                </div>
              </div>
            )
          }

          return (
            <div key={i} className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center select-none bg-sunrise/15 border border-sunrise/30 font-tibetan text-[13px] text-sunrise leading-none pt-0.5">
                ཨ
              </div>
              <div className="max-w-[85%] text-sm leading-relaxed text-foreground pt-1">
                {isStreamingPlaceholder ? <TypingDots /> : <TibetanText text={msg.content} />}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
