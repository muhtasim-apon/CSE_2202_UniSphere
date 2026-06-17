'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { joinRoom, type ChatRoom } from '@/app/lib/chatApi'

type Props = {
  token: string
  onJoined: (room: ChatRoom) => void
  onClose: () => void
}

export default function JoinRoomModal({ token, onJoined, onClose }: Props) {
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleJoin() {
    if (!code.trim()) { setError('Room code is required'); return }
    setLoading(true); setError('')
    try {
      const room = await joinRoom({ room_code: code.trim(), password: password || undefined }, token)
      onJoined(room)
    } catch (e: any) {
      setError(e.message ?? 'Failed to join room')
    } finally { setLoading(false) }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-primary/40 flex items-center justify-center z-50"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-card border border-border rounded-card p-6 w-full max-w-sm shadow-[var(--shadow-card)]"
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-primary font-semibold text-base">Join Room by Code</h2>
            <button onClick={onClose} className="text-muted hover:text-primary transition-colors">
              <X size={18} />
            </button>
          </div>

          <label className="block text-xs font-medium text-muted mb-1">Room code</label>
          <input
            className="w-full bg-background border border-border text-primary rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-accent transition-colors"
            value={code} onChange={e => setCode(e.target.value)} placeholder="Enter room code"
          />

          <label className="block text-xs font-medium text-muted mb-1">Password (if required)</label>
          <input
            type="password"
            className="w-full bg-background border border-border text-primary rounded-lg px-3 py-2 text-sm mb-5 outline-none focus:border-accent transition-colors"
            value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank if none"
          />

          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full bg-cta text-cta-text rounded-lg py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Joining…' : 'Join Room'}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
