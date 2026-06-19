'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Search, UserPlus, Send, Check } from 'lucide-react'
import { getAllStudents, addStudentToCourse, sendInvite, type AllStudent } from '@/app/lib/classesApi'

type Props = {
  token: string
  courseId: number
  joinLinkToken: string
  onClose: () => void
  onStudentAdded: () => void
}

type StudentState = 'idle' | 'adding' | 'added' | 'sending' | 'sent'

export default function AddStudentsModal({ token, courseId, joinLinkToken, onClose, onStudentAdded }: Props) {
  const [students, setStudents] = useState<AllStudent[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [states, setStates] = useState<Record<number, StudentState>>({})

  const load = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const res = await getAllStudents(token, q, courseId)
      setStudents(res.students || [])
    } catch {}
    setLoading(false)
  }, [token, courseId])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => load(search || undefined), 300)
    return () => clearTimeout(t)
  }, [search, load])

  useEffect(() => { load() }, [])

  async function handleAdd(s: AllStudent) {
    setStates(prev => ({ ...prev, [s.student_id]: 'adding' }))
    try {
      await addStudentToCourse(token, courseId, s.student_id)
      setStates(prev => ({ ...prev, [s.student_id]: 'added' }))
      onStudentAdded()
    } catch {
      setStates(prev => ({ ...prev, [s.student_id]: 'idle' }))
    }
  }

  async function handleSendLink(s: AllStudent) {
    setStates(prev => ({ ...prev, [s.student_id]: 'sending' }))
    try {
      await sendInvite(token, courseId, s.student_id)
      setStates(prev => ({ ...prev, [s.student_id]: 'sent' }))
      setTimeout(() => setStates(prev => ({ ...prev, [s.student_id]: states[s.student_id] === 'added' ? 'added' : 'idle' })), 3000)
    } catch {
      setStates(prev => ({ ...prev, [s.student_id]: 'idle' }))
    }
  }

  function initials(first: string, last: string) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative z-10 w-full max-w-xl bg-card border-l border-border shadow-2xl flex flex-col h-full"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-display text-base font-bold text-text-primary">Add Students</h2>
            <p className="text-xs text-muted mt-0.5">Search and add students directly, or send them a join link</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-primary transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or roll number..."
              className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading && students.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-border" />)}
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted">
              {search ? 'No students match your search.' : 'All students are already enrolled.'}
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {students.map((s, i) => {
                  const st = states[s.student_id] || 'idle'
                  const isAdded = st === 'added'
                  const isSent = st === 'sent'
                  return (
                    <motion.div
                      key={s.student_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.15 }}
                      className={`rounded-xl border p-3 transition ${isAdded ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20' : 'border-border bg-card hover:border-accent/40'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                          {initials(s.first_name, s.last_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {s.first_name} {s.last_name}
                          </p>
                          <p className="text-xs text-muted">{s.student_roll}{s.program_code ? ` · ${s.program_code}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Add button */}
                          <button
                            onClick={() => !isAdded && st === 'idle' && handleAdd(s)}
                            disabled={st === 'adding' || isAdded}
                            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                              isAdded
                                ? 'bg-emerald-100 text-emerald-700 cursor-default'
                                : st === 'adding'
                                ? 'bg-primary/20 text-primary/60 cursor-wait'
                                : 'bg-primary text-white hover:opacity-90'
                            }`}
                          >
                            {isAdded ? <><Check className="h-3 w-3" /> Enrolled</> : <><UserPlus className="h-3 w-3" /> Add</>}
                          </button>
                          {/* Send invite button */}
                          <button
                            onClick={() => st === 'idle' && !isAdded && handleSendLink(s)}
                            disabled={st === 'sending' || isSent || isAdded}
                            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                              isSent
                                ? 'bg-blue-100 text-blue-700 cursor-default'
                                : isAdded
                                ? 'opacity-30 cursor-default border border-border text-muted'
                                : 'border border-border text-muted hover:border-accent hover:text-accent'
                            }`}
                            title={isAdded ? 'Already enrolled' : 'Send join link invite'}
                          >
                            {isSent ? <><Check className="h-3 w-3" /> Sent</> : <><Send className="h-3 w-3" /> Invite</>}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
