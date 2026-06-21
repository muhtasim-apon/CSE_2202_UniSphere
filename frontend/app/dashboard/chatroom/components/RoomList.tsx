'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Hash, Users, BookOpen, MessageCircle, Image, Video, Mic, Music, File } from 'lucide-react'
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
  activeTab?: Tab
  onTabChange?: (tab: Tab) => void
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'direct',  label: 'Direct',  icon: <MessageCircle size={13} /> },
  { id: 'advisor', label: 'Advisor', icon: <BookOpen size={13} /> },
  { id: 'group',   label: 'Groups',  icon: <Users size={13} /> },
]

function AttachmentPreview({ type }: { type: string }) {
  const map: Record<string, { icon: React.ReactNode; label: string }> = {
    image:     { icon: <Image size={11} />,  label: 'Image' },
    video:     { icon: <Video size={11} />,  label: 'Video' },
    voicenote: { icon: <Mic size={11} />,    label: 'Voice note' },
    audio:     { icon: <Music size={11} />,  label: 'Audio' },
    file:      { icon: <File size={11} />,   label: 'File' },
  }
  const entry = map[type] ?? map.file
  return (
    <span className="flex items-center gap-1 text-muted italic">
      {entry.icon} {entry.label}
    </span>
  )
}

function formatTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function RoomList({ rooms, activeRoomId, onSelect, onNewRoom, token, onOpenAdvisor, activeTab, onTabChange }: Props) {
  const [tab, setTab] = useState<Tab>(activeTab ?? 'direct')

  useEffect(() => { if (activeTab) setTab(activeTab) }, [activeTab])
  const [showGroup, setShowGroup] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    )
    obs.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const filtered = rooms
    .filter(r =>
      tab === 'advisor' ? r.type === 'advisor' :
      tab === 'group'   ? r.type === 'group' :
      r.type === 'direct'
    )
    .sort((a, b) => {
      const ta = a.last_message?.created_at ?? a.created_at
      const tb = b.last_message?.created_at ?? b.created_at
      return new Date(tb).getTime() - new Date(ta).getTime()
    })

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
            onClick={() => { setTab(t.id); onTabChange?.(t.id) }}
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

        {filtered.map(room => {
          const hoverColor  = isDark ? '#266ca9' : '#e2e2b0'
          const activeColor = isDark ? '#041d56' : '#e2ea71'
          const isActive = activeRoomId === room.id
          return (
          <button
            key={room.id}
            onClick={() => onSelect(room)}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = hoverColor)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = isActive ? activeColor : '')}
            className="w-full text-left px-4 py-3 flex items-start gap-3 border-b border-border/50"
            style={isActive ? { backgroundColor: activeColor } : undefined}
          >
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-accent/20 text-accent flex items-center justify-center flex-shrink-0 text-sm font-bold overflow-hidden">
              {room.type === 'group' ? (
                room.avatar_url
                  ? <img src={room.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span>{room.title?.[0]?.toUpperCase() ?? '#'}</span>
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
                <p className="text-xs truncate mt-0.5">
                  {room.last_message.body
                    ? (() => {
                        if (room.last_message.body!.startsWith('{"_sys"')) {
                          try {
                            const sys = JSON.parse(room.last_message.body!)
                            return <span className="text-muted italic">{sys.text}</span>
                          } catch {}
                        }
                        return <span className="text-muted">{room.last_message.body}</span>
                      })()
                    : room.last_message.attachment_type
                      ? <AttachmentPreview type={room.last_message.attachment_type} />
                      : <span className="text-muted italic">(attachment)</span>
                  }
                </p>
              )}
            </div>
          </button>
          )
        })}
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
