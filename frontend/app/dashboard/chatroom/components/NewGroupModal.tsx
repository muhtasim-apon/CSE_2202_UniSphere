'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2 } from 'lucide-react'
import { createGroupRoom, type ChatRoom } from '@/app/lib/chatApi'

type Props = {
  token: string
  onCreated: (room: ChatRoom) => void
  onClose: () => void
}

export default function NewGroupModal({ token, onCreated, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [memberInput, setMemberInput] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function addMember() {
    const id = memberInput.trim()
    if (id && !members.includes(id)) setMembers(prev => [...prev, id])
    setMemberInput('')
  }

  async function handleCreate() {
    if (!title.trim()) { setError('Title is required'); return }
    setLoading(true); setError('')
    try {
      const room = await createGroupRoom({ title: title.trim(), member_ids: members, password: password || undefined }, token)
      onCreated(room)
    } catch (e: any) {
      setError(e.message ?? 'Failed to create room')
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
          className="bg-card border border-border rounded-card p-6 w-full max-w-md shadow-[var(--shadow-card)]"
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-primary font-semibold text-base">New Group Room</h2>
            <button onClick={onClose} className="text-muted hover:text-primary transition-colors">
              <X size={18} />
            </button>
          </div>

          <label className="block text-xs font-medium text-muted mb-1">Room title</label>
          <input
            className="w-full bg-background border border-border text-primary rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-accent transition-colors"
            value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Study Group"
          />

          <label className="block text-xs font-medium text-muted mb-1">Add members (by profile ID)</label>
          <div className="flex gap-2 mb-2">
            <input
              className="flex-1 bg-background border border-border text-primary rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
              value={memberInput} onChange={e => setMemberInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addMember()}
              placeholder="Paste profile UUID"
            />
            <button onClick={addMember} className="px-3 py-2 bg-cta text-cta-text rounded-lg text-sm hover:opacity-90 transition-opacity">
              <Plus size={15} />
            </button>
          </div>
          {members.map(id => (
            <div key={id} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-1.5 mb-1 text-xs text-primary">
              <span className="truncate font-mono">{id}</span>
              <button onClick={() => setMembers(prev => prev.filter(m => m !== id))} className="ml-2 text-muted hover:text-red-500">
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          <label className="block text-xs font-medium text-muted mt-4 mb-1">Password (optional)</label>
          <input
            type="password"
            className="w-full bg-background border border-border text-primary rounded-lg px-3 py-2 text-sm mb-5 outline-none focus:border-accent transition-colors"
            value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank for no password"
          />

          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full bg-cta text-cta-text rounded-lg py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Creating…' : 'Create Room'}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
