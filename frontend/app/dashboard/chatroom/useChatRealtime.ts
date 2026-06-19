'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChatMessage, ChatReaction, ChatAttachment } from '@/app/lib/chatApi'

export type Typer = { userId: string; displayName: string | null; avatarUrl: string | null }

type Options = {
  roomId: string | null
  currentUserId: string
  currentUserName: string | null
  currentUserAvatar: string | null
  onMessage: (event: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: ChatMessage }) => void
  onReaction: (event: { eventType: 'INSERT' | 'DELETE'; record: ChatReaction }) => void
  onAttachment: (attachment: ChatAttachment) => void
  onTyping: (typers: Typer[]) => void
}

export function useChatRealtime({
  roomId, currentUserId, currentUserName, currentUserAvatar,
  onMessage, onReaction, onAttachment, onTyping,
}: Options) {
  // Always-fresh refs so channel listeners never hold stale closures
  const onMessageRef    = useRef(onMessage)
  const onReactionRef   = useRef(onReaction)
  const onAttachmentRef = useRef(onAttachment)
  const onTypingRef     = useRef(onTyping)
  const currentUserIdRef     = useRef(currentUserId)
  const currentUserNameRef   = useRef(currentUserName)
  const currentUserAvatarRef = useRef(currentUserAvatar)

  onMessageRef.current        = onMessage
  onReactionRef.current       = onReaction
  onAttachmentRef.current     = onAttachment
  onTypingRef.current         = onTyping
  currentUserIdRef.current    = currentUserId
  currentUserNameRef.current  = currentUserName
  currentUserAvatarRef.current = currentUserAvatar

  // Per-user auto-clear timers on the receiver side
  const typerTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const typersMap   = useRef<Record<string, Typer>>({})

  const broadcastChannelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  // ── Channel 1: postgres_changes ────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return
    const supabase = createClient()

    const ch = supabase
      .channel(`chatroom-db:${roomId}`)
      .on('postgres_changes' as any,
        { event: '*', schema: 'public', table: 'chat_message', filter: `room_id=eq.${roomId}` },
        (payload: any) => onMessageRef.current({ eventType: payload.eventType, record: payload.new ?? payload.old })
      )
      .on('postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'chat_message_attachment' },
        (payload: any) => onAttachmentRef.current(payload.new)
      )
      .on('postgres_changes' as any,
        { event: '*', schema: 'public', table: 'chat_message_reaction' },
        (payload: any) => onReactionRef.current({ eventType: payload.eventType, record: payload.new ?? payload.old })
      )
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [roomId])

  // ── Channel 2: broadcast (typing) ──────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return
    const supabase = createClient()

    const ch = supabase
      .channel(`chatroom-typing:${roomId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        const { userId, displayName, avatarUrl, isTyping } = payload
        if (userId === currentUserIdRef.current) return

        // Clear any existing auto-clear timer for this user
        if (typerTimers.current[userId]) clearTimeout(typerTimers.current[userId])

        if (isTyping) {
          typersMap.current[userId] = { userId, displayName, avatarUrl }
          // Auto-clear after 5s if no further typing events arrive
          typerTimers.current[userId] = setTimeout(() => {
            delete typersMap.current[userId]
            delete typerTimers.current[userId]
            onTypingRef.current(Object.values(typersMap.current))
          }, 5000)
        } else {
          delete typersMap.current[userId]
          delete typerTimers.current[userId]
        }

        onTypingRef.current(Object.values(typersMap.current))
      })
      .subscribe()

    broadcastChannelRef.current = ch

    return () => {
      // Clear all pending timers and typers on unmount / room change
      Object.values(typerTimers.current).forEach(clearTimeout)
      typerTimers.current = {}
      typersMap.current = {}
      supabase.removeChannel(ch)
      broadcastChannelRef.current = null
    }
  }, [roomId])

  const sendTyping = useCallback((isTyping: boolean) => {
    broadcastChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId:      currentUserIdRef.current,
        displayName: currentUserNameRef.current,
        avatarUrl:   currentUserAvatarRef.current,
        isTyping,
      },
    })
  }, [])

  return { sendTyping }
}
