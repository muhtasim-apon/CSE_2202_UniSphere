'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChatMessage, ChatReaction, ChatAttachment } from '@/app/lib/chatApi'

type Options = {
  roomId: string | null
  onMessage: (event: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: ChatMessage }) => void
  onReaction: (event: { eventType: 'INSERT' | 'DELETE'; record: ChatReaction }) => void
  onAttachment: (attachment: ChatAttachment) => void
}

export function useChatRealtime({ roomId, onMessage, onReaction, onAttachment }: Options) {
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  useEffect(() => {
    if (!roomId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`chatroom:${roomId}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'chat_message', filter: `room_id=eq.${roomId}` },
        (payload: any) => {
          onMessage({ eventType: payload.eventType, record: payload.new ?? payload.old })
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'chat_message_attachment' },
        (payload: any) => {
          onAttachment(payload.new)
        }
      )
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'chat_message_reaction' },
        (payload: any) => {
          onReaction({ eventType: payload.eventType, record: payload.new ?? payload.old })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])
}
