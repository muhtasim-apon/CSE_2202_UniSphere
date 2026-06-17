'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, UserPlus, MessageCircle, Clock, Check, X } from 'lucide-react'
import {
  getPeople, sendChatRequest, withdrawRequest,
  type PersonEntry, type ChatRoom,
} from '@/app/lib/chatApi'

type Props = {
  token: string
  onOpenRoom: (room: ChatRoom) => void
}

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  if (url) return <img src={url} alt={name ?? ''} className="w-10 h-10 rounded-full object-cover border border-border" />
  return (
    <div className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold flex-shrink-0">
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

export default function PeoplePanel({ token, onOpenRoom }: Props) {
  const [people, setPeople] = useState<PersonEntry[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchPeople = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const data = await getPeople(token, q || undefined)
      setPeople(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchPeople('') }, [fetchPeople])

  useEffect(() => {
    const t = setTimeout(() => fetchPeople(search), 300)
    return () => clearTimeout(t)
  }, [search, fetchPeople])

  async function handleSendRequest(person: PersonEntry) {
    try {
      const req = await sendChatRequest(person.id, token)
      setPeople(prev => prev.map(p =>
        p.id === person.id
          ? { ...p, request_id: req.id, request_status: 'pending', request_direction: 'outgoing' }
          : p
      ))
    } catch (e: any) { console.error(e) }
  }

  async function handleWithdraw(person: PersonEntry) {
    if (!person.request_id) return
    try {
      await withdrawRequest(person.request_id, token)
      setPeople(prev => prev.map(p =>
        p.id === person.id
          ? { ...p, request_id: null, request_status: null, request_direction: null }
          : p
      ))
    } catch (e: any) { console.error(e) }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-4 py-3 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search people…"
            className="w-full bg-background border border-border text-primary text-sm rounded-lg pl-8 pr-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-muted"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="text-xs text-muted text-center py-8">Loading…</p>
        )}
        {!loading && people.length === 0 && (
          <p className="text-xs text-muted text-center py-8">No users found</p>
        )}
        {people.map(person => (
          <motion.div
            key={person.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-4 py-3 border-b border-border/50 hover:bg-secondary/20 transition-colors"
          >
            <Avatar name={person.display_name} url={person.avatar_url} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary truncate">
                {person.display_name ?? 'Unknown'}
              </p>
              <p className="text-xs text-muted capitalize">{person.role ?? 'user'}</p>
            </div>

            {/* Action button */}
            {person.has_direct_room ? (
              // Already connected — show chat icon (open room via parent)
              <button
                onClick={() => {/* room list will show it in Direct tab */}}
                className="flex items-center gap-1 text-xs text-accent border border-accent/40 rounded-lg px-2.5 py-1.5 hover:bg-accent/10 transition-colors"
                title="Open chat"
              >
                <MessageCircle size={13} /> Chat
              </button>
            ) : person.request_status === 'pending' && person.request_direction === 'outgoing' ? (
              <button
                onClick={() => handleWithdraw(person)}
                className="flex items-center gap-1 text-xs text-muted border border-border rounded-lg px-2.5 py-1.5 hover:border-red-400 hover:text-red-500 transition-colors"
                title="Withdraw request"
              >
                <Clock size={13} /> Pending
              </button>
            ) : person.request_status === 'pending' && person.request_direction === 'incoming' ? (
              <span className="text-xs text-muted italic">Sent you a request</span>
            ) : person.request_status === 'accepted' ? (
              <span className="flex items-center gap-1 text-xs text-highlight">
                <Check size={12} /> Connected
              </span>
            ) : (
              <button
                onClick={() => handleSendRequest(person)}
                className="flex items-center gap-1 text-xs bg-cta text-cta-text rounded-lg px-2.5 py-1.5 hover:opacity-90 transition-opacity"
                title="Send message request"
              >
                <UserPlus size={13} /> Message
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
