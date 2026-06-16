'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export type AppNotification = {
  id: string
  title: string
  body: string
  href: string
  type: 'notice' | 'profile' | 'system'
  timestamp: string
  read: boolean
}

type NotificationContextType = {
  notifications: AppNotification[]
  unreadCount: number
  markAllRead: () => void
  clearAll: () => void
  markRead: (id: string) => void
  removeNotification: (id: string) => void
  addNotification: (n: Omit<AppNotification, 'id' | 'read' | 'timestamp'>) => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

const STORAGE_KEY = 'eduhub_notifications'

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

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'read' | 'timestamp'>) => {
    const newNote: AppNotification = {
      ...n,
      id: crypto.randomUUID(),
      read: false,
      timestamp: new Date().toISOString(),
    }
    setNotifications(prev => [newNote, ...prev].slice(0, 50))
  }, [])

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    localStorage.removeItem(STORAGE_KEY)
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
