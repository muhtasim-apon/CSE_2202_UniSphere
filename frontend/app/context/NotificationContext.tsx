'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export type AppNotification = {
  id: string
  title: string
  body: string
  href: string
  type: 'notice' | 'profile' | 'system' | 'new_project' | 'new_certificate' | 'new_research_paper' | 'new_comment' | 'new_reaction' | 'new_rating' | 'new_notice' | 'new_event' | 'general'
  timestamp: string
  read: boolean
}

type AddPayload = Omit<AppNotification, 'id' | 'read' | 'timestamp'> & {
  id?: string
  timestamp?: string
  read?: boolean
}

type NotificationContextType = {
  notifications: AppNotification[]
  unreadCount: number
  markAllRead: () => void
  clearAll: () => void
  markRead: (id: string) => void
  removeNotification: (id: string) => void
  addNotification: (n: AddPayload) => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

const STORAGE_KEY = 'eduhub_notifications'

async function markAllReadInDb() {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase
      .from('notification')
      .update({ is_read: true })
      .eq('recipient_id', session.user.id)
      .eq('is_read', false)
  } catch {}
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setNotifications(JSON.parse(stored))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 50)))
    } catch {}
  }, [notifications])

  const addNotification = useCallback((n: AddPayload) => {
    const newNote: AppNotification = {
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href,
      id: n.id ?? crypto.randomUUID(),
      read: n.read ?? false,
      timestamp: n.timestamp ?? new Date().toISOString(),
    }
    setNotifications(prev => {
      if (prev.some(e => e.id === newNote.id)) return prev
      return [newNote, ...prev].slice(0, 50)
    })
  }, [])

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    markAllReadInDb()
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    localStorage.removeItem(STORAGE_KEY)
    markAllReadInDb()
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, clearAll, markRead, removeNotification, addNotification }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider')
  return ctx
}
