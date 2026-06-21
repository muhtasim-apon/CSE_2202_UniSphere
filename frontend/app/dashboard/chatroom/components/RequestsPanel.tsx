'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Users, MessageCircle } from 'lucide-react'
import {
  getRequests, acceptRequest, declineRequest,
  type ChatRequest, type ChatRoom,
} from '@/app/lib/chatApi'

type Props = {
  token: string
  onRoomCreated: (room: ChatRoom) => void
  pendingCount: number
  onCountChange: (n: number) => void
}

export default function RequestsPanel({ token, onRoomCreated, onCountChange }: Props) {
  const [requests, setRequests] = useState<ChatRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    getRequests(token)
      .then(data => { setRequests(data); onCountChange(data.length) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  async function handleAccept(req: ChatRequest) {
    setActing(req.id)
    try {
      const result = await acceptRequest(req.id, token)
      setRequests(prev => prev.filter(r => r.id !== req.id))
      onCountChange(requests.length - 1)
      onRoomCreated(result.room)
    } catch (e) { console.error(e) }
    finally { setActing(null) }
  }

  async function handleDecline(req: ChatRequest) {
    setActing(req.id)
    try {
      await declineRequest(req.id, token)
      setRequests(prev => prev.filter(r => r.id !== req.id))
      onCountChange(requests.length - 1)
    } catch (e) { console.error(e) }
    finally { setActing(null) }
  }

  if (loading) return <p className="text-xs text-muted text-center py-8">Loading…</p>

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {requests.length === 0 && (
        <p className="text-xs text-muted text-center py-12">No pending requests</p>
      )}
      <AnimatePresence>
        {requests.map(req => {
          const isGroupInvite = !!req.room_id
          return (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 px-4 py-3 border-b border-border/50 hover:bg-secondary/20 transition-colors"
            >
              {/* Icon / Avatar */}
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold flex-shrink-0">
                {isGroupInvite
                  ? <Users size={18} />
                  : (req.sender?.avatar_url
                      ? <img src={req.sender.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                      : (req.sender?.display_name?.[0]?.toUpperCase() ?? '?'))
                }
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary truncate">
                  {req.sender?.display_name ?? 'Someone'}
                </p>
                {isGroupInvite ? (
                  <p className="text-xs text-muted">
                    invited you to join <span className="font-medium text-accent">{req.room_title}</span>
                  </p>
                ) : (
                  <p className="text-xs text-muted flex items-center gap-1">
                    <MessageCircle size={11} /> wants to start a conversation
                  </p>
                )}
              </div>

              {/* Accept / Decline */}
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handleAccept(req)}
                  disabled={acting === req.id}
                  className="p-1.5 rounded-lg bg-highlight/20 text-highlight hover:bg-highlight/30 disabled:opacity-50 transition-colors"
                  title="Accept"
                >
                  <Check size={15} />
                </button>
                <button
                  onClick={() => handleDecline(req)}
                  disabled={acting === req.id}
                  className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                  title="Decline"
                >
                  <X size={15} />
                </button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
