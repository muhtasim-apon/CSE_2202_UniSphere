'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, Copy, Check } from 'lucide-react'
import { createGroupRoom, type ChatRoom } from '@/app/lib/chatApi'

type Props = {
  token: string
  onCreated: (room: ChatRoom) => void
  onClose: () => void
}

export default function NewGroupModal({ token, onCreated, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [emails, setEmails] = useState<string[]>([])
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<{ room: ChatRoom; roomCode: string; notFound: string[] } | null>(null)
  const [copied, setCopied] = useState(false)

  function addEmail() {
    const e = emailInput.trim().toLowerCase()
    if (e && !emails.includes(e)) setEmails(prev => [...prev, e])
    setEmailInput('')
  }

  async function handleCreate() {
    if (!title.trim()) { setError('Title is required'); return }
    setLoading(true); setError('')
    try {
      const result = await createGroupRoom(
        { title: title.trim(), member_emails: emails, password: password || undefined },
        token
      )
      setCreated({ room: result, roomCode: result.room_code, notFound: result.not_found_emails ?? [] })
    } catch (e: any) {
      setError(e.message ?? 'Failed to create room')
    } finally { setLoading(false) }
  }

  function handleCopy() {
    navigator.clipboard.writeText(created!.roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDone() {
    if (created) onCreated(created.room)
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-primary/40 flex items-center justify-center z-50"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={created ? undefined : onClose}
      >
        <motion.div
          className="bg-card border border-border rounded-card p-6 w-full max-w-md shadow-[var(--shadow-card)]"
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-primary font-semibold text-base">
              {created ? 'Group Created!' : 'New Group Room'}
            </h2>
            <button onClick={created ? handleDone : onClose} className="text-muted hover:text-primary transition-colors">
              <X size={18} />
            </button>
          </div>

          {created ? (
            /* ── Success state: show room code ── */
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted">
                Share this code so others can join <span className="font-semibold text-primary">{created.room.title}</span>:
              </p>
              <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-4 py-3">
                <span className="flex-1 text-lg font-mono font-bold text-accent tracking-widest">
                  {created.roomCode}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg hover:bg-secondary/40 transition-colors text-muted hover:text-primary"
                  title="Copy code"
                >
                  {copied ? <Check size={16} className="text-highlight" /> : <Copy size={16} />}
                </button>
              </div>
              {created.notFound.length > 0 && (
                <p className="text-xs text-amber-500">
                  Could not find accounts for: {created.notFound.join(', ')}
                </p>
              )}
              <button
                onClick={handleDone}
                className="w-full bg-cta text-cta-text rounded-lg py-2 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Open Group Chat
              </button>
            </div>
          ) : (
            /* ── Creation form ── */
            <>
              <label className="block text-xs font-medium text-muted mb-1">Room title</label>
              <input
                className="w-full bg-background border border-border text-primary rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-accent transition-colors"
                value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Study Group"
              />

              <label className="block text-xs font-medium text-muted mb-1">Add members by email</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="email"
                  className="flex-1 bg-background border border-border text-primary rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                  value={emailInput} onChange={e => setEmailInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                  placeholder="user@university.edu"
                />
                <button onClick={addEmail} className="px-3 py-2 bg-cta text-cta-text rounded-lg text-sm hover:opacity-90 transition-opacity">
                  <Plus size={15} />
                </button>
              </div>
              {emails.map(email => (
                <div key={email} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-1.5 mb-1 text-xs text-primary">
                  <span className="truncate">{email}</span>
                  <button onClick={() => setEmails(prev => prev.filter(e => e !== email))} className="ml-2 text-muted hover:text-red-500">
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
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
