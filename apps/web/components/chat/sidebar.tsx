"use client";
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'

export type ChatItem = { id: string; title: string };

export function ChatSidebar({
  chats,
  activeId,
  onNew,
  onSelect,
  onDelete,
  className,
}: {
  chats: ChatItem[]
  activeId?: string
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  className?: string
}) {
  return (
    <aside className={cn('flex h-[calc(100dvh-4rem)] w-72 flex-col gap-3 border-r pr-3', className)}>
      <div className="flex items-center gap-2">
        <Button onClick={onNew} className="w-full" size="sm"><Plus className="mr-2 h-4 w-4"/>New Chat</Button>
      </div>
      <div className="flex-1 overflow-auto">
        <ul className="space-y-1">
          {chats.map((c) => (
            <li key={c.id} className={cn('group flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-gray-100', activeId === c.id && 'bg-gray-100')}
                onClick={() => onSelect(c.id)}>
              <span className="truncate" title={c.title}>{c.title || 'Untitled'}</span>
              <button className="invisible ml-2 rounded p-1 text-gray-500 hover:bg-gray-200 group-hover:visible" title="Delete"
                onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}>
                <Trash2 className="h-4 w-4"/>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

