import { MessageSquarePlus } from 'lucide-react'
import type { Conversation } from '@/lib/types/tutor'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface ConversationSidebarProps {
  conversations: Conversation[]
  activeId: number | null
  disableNew: boolean
  onOpen: (id: number) => void
  onNew: () => void
}

export function ConversationSidebar({
  conversations,
  activeId,
  disableNew,
  onOpen,
  onNew,
}: ConversationSidebarProps) {
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col min-h-0 border-r border-border bg-sidebar">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
          Chats
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onNew}
          disabled={disableNew}
          title={disableNew ? 'Already on an empty chat' : 'New chat'}
        >
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-0.5">
          {conversations.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-3">No chats yet.</p>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className={cn(
                'w-full text-left text-sm px-2.5 py-1.5 rounded-lg truncate transition-colors border border-transparent',
                c.id === activeId
                  ? 'bg-card text-foreground font-medium border-border shadow-sm'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
            >
              {c.title}
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
}
