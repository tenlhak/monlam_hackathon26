import { useEffect, useRef } from 'react'
import type { Message } from '@/lib/types/tutor'
import { TibetanText } from '@/lib/tibetan-render'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'

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
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6 text-center">
        <p className="font-tibetan text-4xl leading-relaxed">བཀྲ་ཤིས་བདེ་ལེགས།</p>
        <div>
          <h3 className="font-semibold text-lg">Hi {userName}, I'm your personal Tibetan tutor.</h3>
          <p className="text-muted-foreground text-sm mt-1">What should we learn today?</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {STARTERS.map((s) => (
            <Button
              key={s}
              variant="outline"
              size="sm"
              onClick={() => onStarterClick(s)}
              className="text-sm"
            >
              {s}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-4 p-4 pb-2">
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user'
          const isStreamingPlaceholder = streaming && i === messages.length - 1 && !isUser && msg.content === ''
          return (
            <div key={i} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              <div
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold select-none ${
                  isUser
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isUser ? userName.charAt(0).toUpperCase() : 'S'}
              </div>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted text-foreground rounded-tl-sm'
                }`}
              >
                {isStreamingPlaceholder ? (
                  <TypingDots />
                ) : isUser ? (
                  <p>{msg.content}</p>
                ) : (
                  <TibetanText text={msg.content} />
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
