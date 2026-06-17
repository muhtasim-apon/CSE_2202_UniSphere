'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Hash, Users, BookOpen, MessageCircle } from 'lucide-react'
import type { ChatRoom } from '@/app/lib/chatApi'
import NewGroupModal from './NewGroupModal'
import JoinRoomModal from './JoinRoomModal'

type Tab = 'direct' | 'advisor' | 'group'

type Props = {
  rooms: ChatRoom[]
  activeRoomId: string | null
  onSelect: (room: ChatRoom) => void
  onNewRoom: (room: ChatRoom) => void
  token: string
  onOpenAdvisor: () => void
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'direct',  label: 'Direct',  icon: <MessageCircle size={13} /> },
  { id: 'advisor', label: 'Advisor', icon: <BookOpen size={13} /> },
  { id: 'group',   label: 'Groups',  icon: <Users size={13} /> },
]

function formatTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function RoomList({ rooms, activeRoomId, onSelect, onNewRoom, token, onOpenAdvisor }: Props) {
  const [tab, setTab] = useState<Tab>('direct')
  const [showGroup, setShowGroup] = useState(false)
  const [showJoin, setShowJoin] = useState(false)

  const filtered = rooms.filter(r =>
    tab === 'advisor' ? r.type === 'advisor' :
    tab === 'group'   ? r.type === 'group' :
    r.type === 'direct'
  )

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-semibold text-primary text-sm">Messages</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors duration-theme ${
              tab === t.id
                ? 'text-accent border-b-2 border-accent'
                : 'text-muted hover:text-primary'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'advisor' && (
          <button
            onClick={onOpenAdvisor}
            className="w-full text-left px-4 py-3 hover:bg-secondary/30 transition-colors text-sm text-accent flex items-center gap-2 border-b border-border"
          >
            <BookOpen size={15} /> Open Advisor Chat
          </button>
        )}

        {filtered.length === 0 && tab !== 'advisor' && (
          <p className="text-xs text-muted px-4 py-8 text-center">
            No {tab} chats yet
          </p>
        )}

        {filtered.map(room => (
          <motion.button
            key={room.id}
            whileHover={{ backgroundColor: 'var(--color-secondary)' }}
            onClick={() => onSelect(room)}
            className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-border/50 ${
              activeRoomId === room.id ? 'bg-secondary/40' : ''
            }`}
          >
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-accent/20 text-accent flex items-center justify-center flex-shrink-0 text-sm font-bold overflow-hidden">
              {room.type === 'group' ? (
                <Hash size={15} />
              ) : room.other_avatar_url ? (
                <img src={room.other_avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                room.title?.[0]?.toUpperCase() ?? '?'
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm text-primary font-medium truncate">
                  {room.title ?? (room.type === 'direct' ? 'Direct Chat' : 'Advisor Chat')}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {room.last_message && (
                    <span className="text-[10px] text-muted">
                      {formatTime(room.last_message.created_at)}
                    </span>
                  )}
                  {(room.unread_count ?? 0) > 0 && (
                    <span className="bg-accent text-card text-[10px] rounded-full px-1.5 py-0.5 font-medium">
                      {room.unread_count}
                    </span>
                  )}
                </div>
              </div>
              {room.last_message && (
                <p className="text-xs text-muted truncate mt-0.5">
                  {room.last_message.body ?? '(attachment)'}
                </p>
              )}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Action buttons — only for group tab */}
      {tab === 'group' && (
        <div className="p-3 border-t border-border flex gap-2">
          <button
            onClick={() => setShowGroup(true)}
            className="flex-1 flex items-center justify-center gap-1 py-2 bg-cta text-cta-text rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={13} /> New Group
          </button>
          <button
            onClick={() => setShowJoin(true)}
            className="flex-1 flex items-center justify-center gap-1 py-2 border border-border text-primary rounded-lg text-xs font-medium hover:bg-secondary/30 transition-colors"
          >
            <Hash size={13} /> Join by Code
          </button>
        </div>
      )}

      {showGroup && (
        <NewGroupModal token={token} onCreated={r => { onNewRoom(r); setShowGroup(false) }} onClose={() => setShowGroup(false)} />
      )}
      {showJoin && (
        <JoinRoomModal token={token} onJoined={r => { onNewRoom(r); setShowJoin(false) }} onClose={() => setShowJoin(false)} />
      )}
    </div>
  )
}
