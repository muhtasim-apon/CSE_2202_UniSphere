'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNotifications } from '@/app/context/NotificationContext'

export default function AchievementsRealtimeListener() {
  const { addNotification } = useNotifications()

  useEffect(() => {
    const supabase = createClient()
    // Channel ref lives outside .then() so the useEffect cleanup can reach it.
    // cancelled flag stops the .then() from creating a channel after cleanup ran
    // (happens in React Strict Mode where effects run twice).
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || cancelled) return

      channel = supabase
        .channel(`achievement-notifications-${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notification',
            filter: `recipient_id=eq.${session.user.id}`,
          },
          (payload) => {
            const row = payload.new as {
              notif_type: string
              title: string
              body: string | null
            }
            addNotification({
              type: row.notif_type as
                | 'new_project'
                | 'new_certificate'
                | 'new_research_paper'
                | 'new_comment'
                | 'new_reaction'
                | 'new_rating',
              title: row.title,
              body: row.body ?? '',
              href: '/dashboard/achievements',
            })
          },
        )
        .subscribe()
    })

    return () => {
      cancelled = true
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
    }
  }, [addNotification])

  return null
}
