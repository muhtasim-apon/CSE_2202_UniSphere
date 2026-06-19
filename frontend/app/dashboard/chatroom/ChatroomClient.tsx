'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getRooms, getRequests, openAdvisorRoom, type ChatRoom } from '@/app/lib/chatApi'
import RoomList from './components/RoomList'
import ChatWindow from './components/ChatWindow'
import PeoplePanel from './components/PeoplePanel'
import RequestsPanel from './components/RequestsPanel'
import { MessageSquare, Users, Bell } from 'lucide-react'

type MainTab = 'chats' | 'people' | 'requests'

export default function ChatroomClient({ userId, displayName, avatarUrl }: { userId: string; displayName: string | null; avatarUrl?: string | null }) {
  const [token, setToken] = useState<string | null>(null)
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null)
  const [mainTab, setMainTab] = useState<MainTab>('chats')
  const [pendingCount, setPendingCount] = useState(0)
  const [advisorError, setAdvisorError] = useState('')
  const tokenRef = useRef<string | null>(null)
  const activeRoomRef = useRef<ChatRoom | null>(null)

  // Bootstrap: get session token + keep it fresh via onAuthStateChange
  useEffect(() => {
    const supabase = createClient()

    // Initial load
    supabase.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token
      if (!t) return
      setToken(t)
      tokenRef.current = t
      getRooms(t).then(setRooms).catch(console.error)
      getRequests(t).then(reqs => setPendingCount(reqs.length)).catch(console.error)
    })

    // Refresh token whenever Supabase silently refreshes the session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const t = session?.access_token
      if (!t) return
      setToken(t)
      tokenRef.current = t
    })

    return () => { subscription.unsubscribe() }
  }, [userId])

  // Realtime: room list updates + incoming request badge
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()

    const channel = supabase
      .channel('chatroom-client')
      // New room membership — refresh entire room list so title/avatar are populated
      .on('postgres_changes' as any, {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_room_member',
        filter: `profile_id=eq.${userId}`,
      }, () => {
        const t = tokenRef.current
        if (t) getRooms(t).then(setRooms).catch(console.error)
      })
      // Incoming chat requests badge
      .on('postgres_changes' as any, {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_request',
        filter: `to_id=eq.${userId}`,
      }, () => {
        setPendingCount(n => n + 1)
      })
      .on('postgres_changes' as any, {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_request',
        filter: `to_id=eq.${userId}`,
      }, (payload: any) => {
        if (payload.new?.status !== 'pending') {
          setPendingCount(n => Math.max(0, n - 1))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Subscribe to new messages in all rooms for room-list preview updates
  useEffect(() => {
    if (rooms.length === 0) return
    const supabase = createClient()
    const channels = rooms.map(room =>
      supabase
        .channel(`roomlist:${room.id}`)
        .on('postgres_changes' as any, {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_message',
          filter: `room_id=eq.${room.id}`,
        }, (payload: any) => {
          const msg = payload.new
          const isActive = activeRoomRef.current?.id === room.id
          const isOwn = msg.sender_id === userId
          setRooms(prev => prev.map(r =>
            r.id !== room.id ? r : {
              ...r,
              last_message: { id: msg.id, body: msg.body, sender_id: msg.sender_id, created_at: msg.created_at, attachment_type: null },
              unread_count: (isActive || isOwn) ? 0 : (r.unread_count ?? 0) + 1,
            }
          ))
          // If no body, attachment is uploading — re-fetch after a short delay to get attachment_type
          if (!msg.body) {
            setTimeout(() => {
              const t = tokenRef.current
              if (!t) return
              getRooms(t).then(fresh => {
                setRooms(prev => fresh.map(r => {
                  const old = prev.find(p => p.id === r.id)
                  return { ...r, unread_count: r.id === activeRoomRef.current?.id ? 0 : (old?.unread_count ?? r.unread_count) }
                }))
              }).catch(console.error)
            }, 2000)
          }
        })
        .subscribe()
    )
    return () => { channels.forEach(ch => supabase.removeChannel(ch)) }
  }, [rooms.length, userId])

  function selectRoom(room: ChatRoom) {
    setActiveRoom(room)
    activeRoomRef.current = room
    setRooms(prev => prev.map(r => r.id === room.id ? { ...r, unread_count: 0 } : r))
  }

  async function handleNewRoom(room: ChatRoom, switchTab = true) {
    if (switchTab) setMainTab('chats')
    // Fetch enriched rooms first so title/avatar are correct from the start
    const t = tokenRef.current
    let enrichedRoom = room
    if (t) {
      try {
        const fresh = await getRooms(t)
        setRooms(fresh)
        enrichedRoom = fresh.find(r => r.id === room.id) ?? room
      } catch {
        setRooms(prev => prev.some(r => r.id === room.id) ? prev : [room, ...prev])
      }
    } else {
      setRooms(prev => prev.some(r => r.id === room.id) ? prev : [room, ...prev])
    }
    // Only update activeRoom if it's a different room — prevents ChatWindow remount
    if (activeRoomRef.current?.id !== enrichedRoom.id) {
      selectRoom(enrichedRoom)
    } else {
      // Same room — just refresh the metadata without switching
      setRooms(prev => prev.map(r => r.id === enrichedRoom.id ? enrichedRoom : r))
      activeRoomRef.current = enrichedRoom
      setActiveRoom(enrichedRoom)
    }
  }

  async function handleOpenAdvisor() {
    if (!token) return
    setAdvisorError('')
    try {
      const room = await openAdvisorRoom(token)
      handleNewRoom(room)
    } catch (e: any) {
      setAdvisorError(
        e.message?.includes('No advisor') || e.message?.includes('404')
          ? 'No advisor assigned to your profile yet.'
          : e.message
      )
    }
  }

  if (!token) {
    return <div className="flex items-center justify-center h-full text-muted text-sm">Loading…</div>
  }

  const TABS: { id: MainTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'chats',    label: 'Chats',    icon: <MessageSquare size={15} /> },
    { id: 'people',   label: 'People',   icon: <Users size={15} /> },
    { id: 'requests', label: 'Requests', icon: <Bell size={15} />, badge: pendingCount },
  ]

  return (
    <div className="flex h-[calc(100vh-10rem)] overflow-hidden rounded-card border border-border bg-card shadow-[var(--shadow-card)]">
      {/* Left column */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-border">
        {/* Top-level tabs */}
        <div className="flex border-b border-border">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setMainTab(t.id)}
              className={`relative flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors duration-theme ${
                mainTab === t.id
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-muted hover:text-primary'
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
              {(t.badge ?? 0) > 0 && (
                <span className="absolute top-1 right-1 bg-notification text-white text-[9px] rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 font-bold">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {mainTab === 'chats' && (
            <RoomList
              rooms={rooms}
              activeRoomId={activeRoom?.id ?? null}
              onSelect={selectRoom}
              onNewRoom={handleNewRoom}
              token={token}
              onOpenAdvisor={handleOpenAdvisor}
            />
          )}
          {mainTab === 'people' && (
            <PeoplePanel token={token} onOpenRoom={room => handleNewRoom(room, false)} />
          )}
          {mainTab === 'requests' && (
            <RequestsPanel
              token={token}
              onRoomCreated={handleNewRoom}
              pendingCount={pendingCount}
              onCountChange={setPendingCount}
            />
          )}
        </div>

        {advisorError && (
          <p className="px-4 py-2 text-xs text-red-500 border-t border-border">
            {advisorError}
          </p>
        )}
      </div>

      {/* Right: chat window */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {activeRoom ? (
          <ChatWindow
            key={activeRoom.id}
            roomId={activeRoom.id}
            roomType={activeRoom.type}
            roomTitle={activeRoom.title ?? (activeRoom.type === 'group' ? 'Group Chat' : 'Advisor Chat')}
            roomAvatar={activeRoom.other_avatar_url}
            roomCode={activeRoom.room_code}
            roomCreatedBy={activeRoom.created_by}
            currentUserId={userId}
            currentUserName={displayName}
            currentUserAvatar={avatarUrl}
            token={token}
            onRoomDeleted={(rid) => {
              setRooms(prev => prev.filter(r => r.id !== rid))
              setActiveRoom(null)
              activeRoomRef.current = null
            }}
            onNewMessage={(roomId, senderId, body, createdAt, attachmentType) => {
              setRooms(prev => prev.map(r => {
                if (r.id !== roomId) return r
                const isActive = activeRoomRef.current?.id === roomId
                const isOwn = senderId === userId
                return {
                  ...r,
                  last_message: { id: '', body, sender_id: senderId, created_at: createdAt, attachment_type: (attachmentType ?? null) as 'audio' | 'video' | 'image' | 'file' | 'voicenote' | null },
                  unread_count: (isActive || isOwn) ? 0 : (r.unread_count ?? 0) + 1,
                }
              }))
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted gap-3 select-none">
            <MessageSquare size={48} className="opacity-20" />
            <p className="text-sm">
              {mainTab === 'people' ? 'Send a message request to start a chat' : 'Select a conversation'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
