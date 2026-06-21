'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNotifications } from '@/app/context/NotificationContext'
import type { AppNotification } from '@/app/context/NotificationContext'

type DbRow = {
  notification_id: number
  notif_type: string
  title: string
  body: string | null
  created_at: string
  is_read: boolean
}

function resolveHref(notifType: string, title: string): string {
  switch (notifType) {
    case 'new_project':
    case 'new_certificate':
    case 'new_research_paper':
    case 'new_comment':
    case 'new_reaction':
    case 'new_rating':
      return '/dashboard/achievements'
    case 'new_notice':
    case 'new_event':
      return '/dashboard/notice-board'
    case 'general':
      if (/exam|mark|grade|cgpa|result/i.test(title)) return '/dashboard/classes'
      if (/course|enroll|invite|resource/i.test(title)) return '/dashboard/classes'
      if (/notice|announce/i.test(title)) return '/dashboard/notice-board'
      return '/dashboard'
    default:
      return '/dashboard'
  }
}

function rowToPayload(row: DbRow) {
  return {
    id: `db-${row.notification_id}`,
    type: row.notif_type as AppNotification['type'],
    title: row.title,
    body: row.body ?? '',
    href: resolveHref(row.notif_type, row.title),
    timestamp: row.created_at,
    read: row.is_read,
  }
}

export default function NotificationRealtimeListener() {
  const { addNotification } = useNotifications()

  useEffect(() => {
    const supabase = createClient()
    let notifChannel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session || cancelled) return

      // ── Fetch user role for audience filtering ──────────────────────────────
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      const userRole = profile?.role ?? 'student'
      const userId = session.user.id

      // ── 1. Load existing unread notifications from DB (missed while offline) ─
      const { data: existing } = await supabase
        .from('notification')
        .select('*')
        .eq('recipient_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(30)

      if (!cancelled && existing) {
        ;[...(existing as DbRow[])].reverse().forEach(row => {
          addNotification(rowToPayload(row))
        })
      }

      if (cancelled) return

      // ── 2. Live subscription: notification table ─────────────────────────────
      notifChannel = supabase
        .channel(`notifications-global-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notification',
            filter: `recipient_id=eq.${userId}`,
          },
          (payload) => {
            addNotification(rowToPayload(payload.new as DbRow))
          },
        )
        .subscribe()
    })

    return () => {
      cancelled = true
      if (notifChannel) supabase.removeChannel(notifChannel)
    }
  }, [addNotification])

  return null
}
