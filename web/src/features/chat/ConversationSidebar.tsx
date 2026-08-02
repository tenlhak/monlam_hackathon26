import { MessageSquarePlus, X } from 'lucide-react'
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
  /** Mobile-only: renders as a slide-over instead of the static desktop column. */
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function ConversationSidebar({
  conversations,
  activeId,
  disableNew,
  onOpen,
  onNew,
  mobileOpen = false,
  onMobileClose,
}: ConversationSidebarProps) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 md:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={cn(
          'flex-col min-h-0 border-r border-border bg-sidebar',
          'md:flex md:static md:w-56 md:shadow-none',
          mobileOpen
            ? 'fixed inset-y-0 left-0 z-50 flex w-64 shadow-xl'
            : 'hidden',
        )}
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
            Chats
          </span>
          <div className="flex items-center gap-0.5">
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
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 md:hidden"
              onClick={onMobileClose}
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-0.5">
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-3">No chats yet.</p>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onOpen(c.id)
                  onMobileClose?.()
                }}
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
    </>
  )
}
