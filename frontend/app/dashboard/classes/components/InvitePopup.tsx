'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mail, BookOpen, X, Check } from 'lucide-react'
import { getMyInvites, dismissInvite, joinByToken, type CourseInvite } from '@/app/lib/classesApi'

type Props = {
  token: string
  onCourseJoined: () => void
}

export default function InvitePopup({ token, onCourseJoined }: Props) {
  const [invites, setInvites] = useState<CourseInvite[]>([])
  const [joining, setJoining] = useState<number | null>(null)
  const [dismissing, setDismissing] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await getMyInvites(token)
      setInvites(res.invites || [])
    } catch {}
  }, [token])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  async function handleJoin(invite: CourseInvite) {
    setJoining(invite.invite_id)
    try {
      const res = await joinByToken(token, invite.join_link_token)
      setInvites(prev => prev.filter(i => i.invite_id !== invite.invite_id))
      setToast(`Joined ${res.course_name || invite.course_name}!`)
      setTimeout(() => setToast(null), 3000)
      onCourseJoined()
    } catch {}
    setJoining(null)
  }

  async function handleDismiss(invite: CourseInvite) {
    setDismissing(invite.invite_id)
    try {
      await dismissInvite(token, invite.invite_id)
      setInvites(prev => prev.filter(i => i.invite_id !== invite.invite_id))
    } catch {}
    setDismissing(null)
  }

  if (invites.length === 0 && !toast) return null

  return (
    <div className="space-y-3 mb-2">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 text-sm font-medium text-emerald-700"
          >
            <Check className="h-4 w-4" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {invites.length > 0 && (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3">
            <Mail className="h-4 w-4 text-accent flex-shrink-0" />
            <p className="text-sm font-semibold text-text-primary">
              You have {invites.length} class invite{invites.length > 1 ? 's' : ''}
            </p>
          </div>

          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {invites.map(invite => (
                <motion.div
                  key={invite.invite_id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl border border-border bg-card p-4 space-y-2 hover:border-accent/50 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 flex-shrink-0">
                      <BookOpen className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-text-primary">{invite.course_name}</p>
                        {invite.course_code && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{invite.course_code}</span>
                        )}
                        {invite.semester && (
                          <span className="text-xs text-muted">{invite.semester}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        {invite.instructor_name} invited you to join this class
                      </p>
                      {invite.message && (
                        <p className="text-xs text-text-primary mt-1 italic">"{invite.message}"</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleJoin(invite)}
                      disabled={joining === invite.invite_id}
                      className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition disabled:opacity-60"
                    >
                      {joining === invite.invite_id ? 'Joining…' : 'Join Class →'}
                    </button>
                    <button
                      onClick={() => handleDismiss(invite)}
                      disabled={dismissing === invite.invite_id}
                      className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted hover:border-primary hover:text-primary transition disabled:opacity-60"
                    >
                      <X className="h-3 w-3" />
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  )
}
