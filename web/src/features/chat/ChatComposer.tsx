import { useState, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'

interface ChatComposerProps {
  onSend: (text: string) => void
  disabled: boolean
}

export function ChatComposer({ onSend, disabled }: ChatComposerProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const text = value.trim()
    if (!text || disabled) return
    onSend(text)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`
  }

  return (
    <div className="shrink-0">
      <Separator />
      <div className="flex items-end gap-2 p-3">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Message your tutor… (Enter to send, Shift+Enter for newline)"
          disabled={disabled}
          rows={1}
          className="resize-none min-h-9 max-h-[150px] text-sm leading-snug"
        />
        <Button
          size="icon"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="shrink-0 h-9 w-9"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
