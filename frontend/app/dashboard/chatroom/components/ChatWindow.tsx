'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Paperclip, X, Mic, Square, MoreVertical, Copy, Check, Trash2, LogOut, Pencil, UserPlus, Users, ImagePlus } from 'lucide-react'
import {
  getMessages, sendMessage, editMessage, deleteMessage,
  uploadChatAttachment, addReaction, removeReaction, markRead, deleteRoom, renameRoom,
  getRoomMembers, inviteMember, getPeople,
  type ChatMessage, type ReactionType, type RoomMember, type PendingInvite, type PersonEntry, setGroupAvatar, setMemberNickname,
} from '@/app/lib/chatApi'
import { createClient } from '@/lib/supabase/client'
import { useChatRealtime } from '../useChatRealtime'
import MessageBubble from './MessageBubble'
import ImageCropModal from './ImageCropModal'

type Props = {
  roomId: string
  roomType: 'direct' | 'advisor' | 'group'
  roomTitle: string | null
  roomAvatar?: string | null
  roomCode?: string | null
  roomCreatedBy?: string
  currentUserId: string
  currentUserName: string | null
  currentUserAvatar?: string | null
  token: string
  onNewMessage?: (roomId: string, senderId: string, body: string | null, createdAt: string, attachmentType?: string | null) => void
  onRoomDeleted?: (roomId: string) => void
  onRoomRenamed?: (roomId: string, newTitle: string) => void
}

export default function ChatWindow({ roomId, roomType, roomTitle, roomAvatar, roomCode, roomCreatedBy, currentUserId, currentUserName, currentUserAvatar, token, onNewMessage, onRoomDeleted, onRoomRenamed }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const replyToRef = useRef<ChatMessage | null>(null)
  const setReplyToSync = useCallback((msg: ChatMessage | null) => {
    replyToRef.current = msg
    setReplyTo(msg)
    if (msg) requestAnimationFrame(() => textareaRef.current?.focus())
  }, [])
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const [groupAvatar, setGroupAvatarState] = useState<string | null>(roomAvatar ?? null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  // Sync avatar when prop changes (e.g. after refresh)
  useEffect(() => { setGroupAvatarState(roomAvatar ?? null) }, [roomAvatar])
  const shouldScrollRef = useRef(true) // only scroll to bottom for new messages, not history loads
  const prevScrollHeightRef = useRef<number | null>(null) // set before prepending older messages
  // Cache sender profiles so realtime messages can show the correct name/avatar
  const profileCache = useRef<Record<string, { display_name: string | null; avatar_url: string | null }>>({})
  // Seed own profile immediately
  profileCache.current[currentUserId] = { display_name: currentUserName, avatar_url: currentUserAvatar ?? null }

  const [fetchError, setFetchError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const [members, setMembers] = useState<RoomMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  // nicknameMap: profileId → display label (nickname or first name)
  const [nicknameMap, setNicknameMap] = useState<Record<string, string>>({})
  const [showNicknames, setShowNicknames] = useState(false)
  const [editingNickname, setEditingNickname] = useState<string | null>(null) // profileId
  const [nicknameInput, setNicknameInput] = useState('')
  const [showAddMember, setShowAddMember] = useState(false)
  const [addMemberSearch, setAddMemberSearch] = useState('')
  const [addMemberRole, setAddMemberRole] = useState<'student' | 'teacher'>('student')
  const [addMemberPeople, setAddMemberPeople] = useState<PersonEntry[]>([])
  const [inviting, setInviting] = useState<string | null>(null)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [typers, setTypers] = useState<{ userId: string; displayName: string | null; avatarUrl?: string | null }[]>([])
  const typingTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isTypingActiveRef = useRef(false)
  const [recording, setRecording] = useState(false)
  const [recordingSecs, setRecordingSecs] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (before?: string) => {
    if (!token) return
    try {
      setFetchError('')
      const msgs = await getMessages(roomId, token, before)
      if (msgs.length < 30) setHasMore(false)
      // Resolve reply previews from the batch itself
      const msgMap = Object.fromEntries(msgs.map(m => [m.id, m]))
      const enriched = msgs.map(m => ({
        ...m,
        reply: m.reply_to ? (msgMap[m.reply_to] ? { id: m.reply_to, body: msgMap[m.reply_to].body, sender_id: msgMap[m.reply_to].sender_id } : null) : null,
      }))
      // Populate profile cache from loaded messages
      msgs.forEach(m => {
        if (m.sender_id && m.sender) profileCache.current[m.sender_id] = m.sender
      })
      if (before) {
        // Loading older messages — record height before prepending; restore in useLayoutEffect
        if (enriched.length === 0) return  // nothing to prepend
        shouldScrollRef.current = false
        prevScrollHeightRef.current = scrollRef.current?.scrollHeight ?? null
        setMessages(prev => [...enriched.reverse(), ...prev])
      } else {
        shouldScrollRef.current = true
        setMessages([...enriched].reverse())
      }
    } catch (e: any) {
      setFetchError(e.message?.includes('fetch') ? 'Cannot reach server. Is the backend running?' : e.message)
    }
  }, [roomId, token])

  useEffect(() => {
    setMessages([])
    setFetchError('')
    setHasMore(true)
    load()
    markRead(roomId, token).catch(() => {})
  }, [roomId, load, token])

  function refreshGroupMembers() {
    getRoomMembers(roomId, token).then(({ members: m, pending_invites: p }) => {
      setMembers(m)
      setPendingInvites(p)
      const map: Record<string, string> = {}
      m.forEach(mem => {
        const firstName = mem.profiles?.display_name?.split(' ')[0] ?? 'Unknown'
        map[mem.profile_id] = mem.nickname ?? firstName
        if (mem.profiles) {
          profileCache.current[mem.profile_id] = {
            display_name: mem.profiles.display_name,
            avatar_url: mem.profiles.avatar_url,
          }
        }
      })
      setNicknameMap(map)
      // Patch any messages whose sender wasn't in cache yet
      setMessages(prev => prev.map(msg => ({
        ...msg,
        sender: msg.sender ?? profileCache.current[msg.sender_id] ?? null,
      })))
    }).catch(() => {})
  }

  // For group chats: load members on mount to populate nickname + avatar maps
  useEffect(() => {
    if (roomType !== 'group') return
    refreshGroupMembers()
  }, [roomId, roomType, token])

  // Subscribe to new members joining so profileCache stays current
  useEffect(() => {
    if (roomType !== 'group') return
    const supabase = createClient()
    const ch = supabase
      .channel(`members:${roomId}`)
      .on('postgres_changes' as any, {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_room_member',
        filter: `room_id=eq.${roomId}`,
      }, () => { refreshGroupMembers() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [roomId, roomType, token])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (prevScrollHeightRef.current !== null) {
      // Synchronously restore position after prepending older messages
      el.scrollTop = el.scrollHeight - prevScrollHeightRef.current
      prevScrollHeightRef.current = null
      shouldScrollRef.current = true
    } else if (shouldScrollRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length])

  const { sendTyping } = useChatRealtime({
    roomId,
    currentUserId,
    currentUserName,
    currentUserAvatar: currentUserAvatar ?? null,
    onTyping: setTypers,
    onAttachment: (att) => {
      setMessages(prev => prev.map(m =>
        m.id === att.message_id
          ? { ...m, attachments: m.attachments.some(a => a.id === att.id) ? m.attachments : [...m.attachments, att] }
          : m
      ))
    },
    onMessage: ({ eventType, record }) => {
      if (eventType === 'INSERT') {
        setMessages(prev => {
          if (prev.some(m => m.id === record.id)) return prev
          const parent = record.reply_to ? prev.find(m => m.id === record.reply_to) ?? null : null
          const reply = parent ? { id: parent.id, body: parent.body, sender_id: parent.sender_id } : null
          const sender = profileCache.current[record.sender_id] ?? null
          shouldScrollRef.current = true
          return [...prev, { ...record, attachments: [], reactions: [], sender, reply }]
        })
        onNewMessage?.(roomId, record.sender_id, record.body, record.created_at)
        markRead(roomId, token).catch(() => {})
      } else if (eventType === 'UPDATE') {
        setMessages(prev => prev.map(m => m.id === record.id ? { ...m, ...record } : m))
      } else if (eventType === 'DELETE') {
        setMessages(prev => prev.filter(m => m.id !== record.id))
      }
    },
    onReaction: ({ eventType, record }) => {
      setMessages(prev => prev.map(m => {
        if (m.id !== record.message_id) return m
        if (eventType === 'INSERT') return { ...m, reactions: [...m.reactions.filter(r => r.id !== record.id), record] }
        return { ...m, reactions: m.reactions.filter(r => r.id !== record.id) }
      }))
    },
  })

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed && !pendingFile) return
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    if (typingIntervalRef.current) { clearInterval(typingIntervalRef.current); typingIntervalRef.current = null }
    isTypingActiveRef.current = false
    sendTyping(false)
    setLoading(true)
    try {
      const msg = await sendMessage(roomId, { body: trimmed || undefined, reply_to: replyTo?.id, has_attachment: !!pendingFile }, token)
      let attType: string | null = null
      if (pendingFile) {
        const att = await uploadChatAttachment(msg.id, pendingFile, token)
        attType = att.file_type ?? null
        setMessages(prev => prev.map(m =>
          m.id === msg.id ? { ...m, attachments: [...m.attachments, att] } : m
        ))
        setPendingFile(null)
      }
      onNewMessage?.(roomId, currentUserId, msg.body, msg.created_at, attType)
      setBody('')
      setReplyToSync(null)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleEdit() {
    if (!editingMsg || !body.trim()) return
    try {
      const updated = await editMessage(editingMsg.id, body.trim(), token)
      setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
      setEditingMsg(null)
      setBody('')
    } catch (e) { console.error(e) }
  }

  async function handleDelete(msgId: string) {
    await deleteMessage(msgId, token)
    setMessages(prev => prev.filter(m => m.id !== msgId))
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
        const pendingReply = replyToRef.current
        setLoading(true)
        try {
          const msg = await sendMessage(roomId, { has_attachment: true, reply_to: pendingReply?.id }, token)
          const att = await uploadChatAttachment(msg.id, file, token)
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, attachments: [...m.attachments, att] } : m))
          onNewMessage?.(roomId, currentUserId, null, msg.created_at, att.file_type ?? 'voicenote')
          setReplyToSync(null)
          replyToRef.current = null
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
      setRecordingSecs(0)
      recordingTimerRef.current = setInterval(() => setRecordingSecs(s => s + 1), 1000)
    } catch {
      alert('Microphone access denied.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    setRecording(false)
    setRecordingSecs(0)
  }

  function startEdit(msg: ChatMessage) {
    setEditingMsg(msg)
    setBody(msg.body ?? '')
    setReplyTo(null)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  async function handleDeleteRoom() {
    if (!confirm(roomType === 'group' && roomCreatedBy === currentUserId
      ? 'Delete this group for everyone?'
      : roomType === 'group'
        ? 'Leave this group?'
        : 'Delete this conversation?')) return
    try {
      await deleteRoom(roomId, token)
      onRoomDeleted?.(roomId)
    } catch (e) { console.error(e) }
  }

  function copyRoomCode() {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  async function handleRename() {
    const trimmed = renameValue.trim()
    if (!trimmed) return
    try {
      await renameRoom(roomId, trimmed, token)
      onRoomRenamed?.(roomId, trimmed)
      setRenaming(false)
    } catch (e) { console.error(e) }
  }

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const objectUrl = URL.createObjectURL(file)
    setCropSrc(objectUrl)
  }

  async function handleCropDone(croppedFile: File) {
    setCropSrc(null)
    try {
      const url = await setGroupAvatar(roomId, croppedFile, token)
      setGroupAvatarState(url)
    } catch (err) { console.error(err) }
  }

  function buildNicknameMap(memberList: RoomMember[]) {
    const map: Record<string, string> = {}
    for (const m of memberList) {
      const firstName = m.profiles?.display_name?.split(' ')[0] ?? 'Unknown'
      map[m.profile_id] = m.nickname ?? firstName
    }
    setNicknameMap(map)
  }

  async function openMembers() {
    setShowMembers(true)
    setMembersLoading(true)
    try {
      const { members: m, pending_invites: p } = await getRoomMembers(roomId, token)
      setMembers(m)
      setPendingInvites(p)
      buildNicknameMap(m)
    } catch (e) { console.error(e) }
    finally { setMembersLoading(false) }
  }

  async function handleSaveNickname(profileId: string) {
    const trimmed = nicknameInput.trim() || null
    try {
      await setMemberNickname(roomId, profileId, trimmed, token)
      const target = members.find(m => m.profile_id === profileId)
      const firstName = target?.profiles?.display_name?.split(' ')[0] ?? 'Unknown'
      const setterName = currentUserName?.split(' ')[0] ?? 'Someone'
      const sysText = trimmed
        ? `${setterName} set the nickname for ${firstName} to "${trimmed}"`
        : `${setterName} removed the nickname for ${firstName}`
      await sendMessage(roomId, { body: JSON.stringify({ _sys: 'nickname', text: sysText }) }, token)
      setMembers(prev => prev.map(m => m.profile_id === profileId ? { ...m, nickname: trimmed } : m))
      setNicknameMap(prev => ({ ...prev, [profileId]: trimmed ?? firstName }))
    } catch (e) { console.error(e) }
    finally { setEditingNickname(null); setShowNicknames(false) }
  }

  async function openAddMember() {
    setShowAddMember(true)
    setAddMemberSearch('')
    // Pre-populate with already-invited and already-member profile IDs
    let knownPending = pendingInvites
    let knownMembers = members
    if (knownPending.length === 0 && knownMembers.length === 0) {
      try {
        const { members: m, pending_invites: p } = await getRoomMembers(roomId, token)
        setMembers(m); setPendingInvites(p); buildNicknameMap(m)
        knownPending = p; knownMembers = m
      } catch (e) { console.error(e) }
    }
    const alreadyKnown = new Set<string>([
      ...knownPending.map(p => p.to_id),
      ...knownMembers.map(m => m.profile_id),
    ])
    setInvitedIds(alreadyKnown)
    loadAddMemberPeople('student', '')
  }

  async function loadAddMemberPeople(role: 'student' | 'teacher', search: string) {
    try {
      const list = await getPeople(token, search || undefined)
      const r = role === 'teacher' ? ['faculty', 'teacher'] : ['student']
      setAddMemberPeople(list.filter(p => r.includes(p.role?.toLowerCase() ?? '')))
    } catch (e) { console.error(e) }
  }

  async function handleInvite(person: PersonEntry) {
    setInviting(person.id)
    try {
      await inviteMember(roomId, person.id, token)
      setInvitedIds(prev => new Set([...prev, person.id]))
      setPendingInvites(prev => [...prev, {
        to_id: person.id,
        created_at: new Date().toISOString(),
        invitee: { display_name: person.display_name, avatar_url: person.avatar_url },
      }])
    } catch (e) { console.error(e) }
    finally { setInviting(null) }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Conversation header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        <div className="w-9 h-9 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0">
          {(groupAvatar || roomAvatar)
            ? <img src={groupAvatar || roomAvatar!} alt="" className="w-full h-full object-cover" />
            : <span>{roomTitle?.[0]?.toUpperCase() ?? '?'}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-primary truncate block">{roomTitle ?? 'Chat'}</span>
          {roomType === 'group' && roomCode && (
            <button
              onClick={copyRoomCode}
              className="flex items-center gap-1 text-[10px] text-muted hover:text-accent transition-colors mt-0.5"
              title="Copy room code"
            >
              <span className="font-mono">{roomCode}</span>
              {codeCopied ? <Check size={10} className="text-highlight" /> : <Copy size={10} />}
            </button>
          )}
        </div>

        {/* 3-dots menu */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-secondary/30 transition-colors"
          >
            <MoreVertical size={16} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.1 }}
                className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden"
                onMouseLeave={() => setMenuOpen(false)}
              >
                {roomType === 'group' && (
                  <>
                    <button
                      onClick={() => { setMenuOpen(false); openMembers() }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-primary hover:bg-secondary/30 transition-colors"
                    >
                      <Users size={13} /> View members
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); openAddMember() }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-primary hover:bg-secondary/30 transition-colors"
                    >
                      <UserPlus size={13} /> Add member
                    </button>
                    <button
                      onClick={async () => { setMenuOpen(false); setShowNicknames(true); setEditingNickname(null); if (members.length === 0) { setMembersLoading(true); try { const { members: m, pending_invites: p } = await getRoomMembers(roomId, token); setMembers(m); setPendingInvites(p); buildNicknameMap(m) } catch(e){} finally { setMembersLoading(false) } } }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-primary hover:bg-secondary/30 transition-colors"
                    >
                      <Pencil size={13} /> Set nicknames
                    </button>
                    <div className="mx-3 my-1 border-t border-border" />
                    {roomCode && (
                      <button
                        onClick={() => { copyRoomCode(); setMenuOpen(false) }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-primary hover:bg-secondary/30 transition-colors"
                      >
                        <Copy size={13} /> Copy room code
                      </button>
                    )}
                    {roomCreatedBy === currentUserId && (
                      <>
                        <button
                          onClick={() => { setRenameValue(roomTitle ?? ''); setRenaming(true); setMenuOpen(false) }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-primary hover:bg-secondary/30 transition-colors"
                        >
                          <Pencil size={13} /> Rename group
                        </button>
                        <button
                          onClick={() => { setMenuOpen(false); avatarFileRef.current?.click() }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-primary hover:bg-secondary/30 transition-colors"
                        >
                          <ImagePlus size={13} /> Set group avatar
                        </button>
                      </>
                    )}
                    <div className="mx-3 my-1 border-t border-border" />
                  </>
                )}
                <button
                  onClick={() => { setMenuOpen(false); handleDeleteRoom() }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  {roomType === 'group' && roomCreatedBy !== currentUserId
                    ? <><LogOut size={13} /> Leave group</>
                    : <><Trash2 size={13} /> {roomType === 'group' ? 'Delete group' : 'Delete conversation'}</>
                  }
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Messages scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 overscroll-contain"
        style={{ willChange: 'scroll-position', WebkitOverflowScrolling: 'touch' }}
      >
        {fetchError && (
          <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
            {fetchError}
            <button onClick={() => load()} className="ml-auto underline text-xs">Retry</button>
          </div>
        )}
        {hasMore && (
          <button
            onClick={() => load(messages[0]?.created_at)}
            className="w-full text-center text-xs text-muted hover:text-primary mb-4 transition-colors"
          >
            Load older messages
          </button>
        )}
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            currentUserId={currentUserId}
            grouped={i > 0 && messages[i - 1].sender_id === msg.sender_id}
            groupedNext={i < messages.length - 1 && messages[i + 1].sender_id === msg.sender_id}
            isGroup={roomType === 'group'}
            displayName={nicknameMap[msg.sender_id] ?? msg.sender?.display_name?.split(' ')[0] ?? null}
            senderAvatar={msg.sender?.avatar_url ?? profileCache.current[msg.sender_id]?.avatar_url ?? null}
            onReply={setReplyToSync}
            onEdit={startEdit}
            onDelete={handleDelete}
            onReact={(id, r) => addReaction(id, r, token)}
            onUnreact={(id, r) => removeReaction(id, r, token)}
          />
        ))}

        {/* Typing indicator — exact same layout as an incoming MessageBubble */}
        <AnimatePresence>
          {typers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="flex gap-2 mt-3 mb-0.5 flex-row"
            >
              {/* Stacked avatars — each overlaps the previous by 8px */}
              <div
                className="flex-shrink-0 flex items-end"
                style={{ width: `${Math.min(typers.length, 3) * 20 + 12}px`, minWidth: '2rem' }}
              >
                {typers.slice(0, 3).map((t, i) => {
                  const avatarUrl = t.avatarUrl ?? profileCache.current[t.userId]?.avatar_url
                  const initial = (t.displayName ?? '?')[0]?.toUpperCase()
                  return (
                    <motion.div
                      key={t.userId}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.05 }}
                      className="w-7 h-7 rounded-full border-2 border-background flex-shrink-0 overflow-hidden bg-accent/20 text-accent flex items-center justify-center text-[10px] font-bold"
                      style={{ marginLeft: i === 0 ? 0 : -8, zIndex: i }}
                      title={t.displayName ?? ''}
                    >
                      {avatarUrl
                        ? <img src={avatarUrl} alt={t.displayName ?? ''} className="w-full h-full object-cover" />
                        : initial
                      }
                    </motion.div>
                  )
                })}
              </div>

              {/* Bubble */}
              <div className="max-w-[70%] flex flex-col items-start">
                <div className="px-4 py-2 bg-card text-primary border border-border rounded-2xl rounded-tl-sm flex items-center gap-1.5" style={{ minHeight: '2.375rem' }}>
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      className="block w-2 h-2 rounded-full bg-muted"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reply / Edit banner */}
      {(replyTo || editingMsg) && (
        <div className="px-4 py-2 bg-card border-t border-border flex items-center justify-between">
          <span className="text-xs text-accent font-medium">
            {editingMsg
              ? 'Editing message'
              : `Replying to: ${replyTo?.body?.slice(0, 60) ?? '(attachment)'}`}
          </span>
          <button onClick={() => { setReplyToSync(null); setEditingMsg(null); setBody('') }}>
            <X size={13} className="text-muted hover:text-primary" />
          </button>
        </div>
      )}

      {/* Pending file indicator */}
      {pendingFile && (
        <div className="px-4 py-1 bg-card border-t border-border flex items-center gap-2">
          <span className="text-xs text-primary truncate">{pendingFile.name}</span>
          <button onClick={() => setPendingFile(null)}>
            <X size={12} className="text-muted" />
          </button>
        </div>
      )}

      {/* Recording indicator */}
      {recording && (
        <div className="px-4 py-2 bg-card border-t border-border flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm text-primary">Recording… {recordingSecs}s</span>
          <button onClick={stopRecording} className="ml-auto flex items-center gap-1.5 text-xs text-red-500 hover:opacity-80">
            <Square size={12} fill="currentColor" /> Stop & Send
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="px-4 py-3 bg-card border-t border-border flex items-end gap-2">
        <input type="file" ref={fileRef} className="hidden" onChange={e => setPendingFile(e.target.files?.[0] ?? null)} />
        <button
          onClick={() => fileRef.current?.click()}
          className="p-2 rounded-lg text-muted hover:text-accent hover:bg-secondary/30 transition-colors"
        >
          <Paperclip size={18} />
        </button>
        <textarea
          ref={textareaRef}
          rows={1}
          value={body}
          onChange={e => {
            setBody(e.target.value)
            // On idle → typing: send immediately and start keep-alive interval
            if (!isTypingActiveRef.current) {
              isTypingActiveRef.current = true
              sendTyping(true)
              typingIntervalRef.current = setInterval(() => sendTyping(true), 3000)
            }
            // Reset the idle-stop timer on every keystroke
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
            typingTimerRef.current = setTimeout(() => {
              isTypingActiveRef.current = false
              if (typingIntervalRef.current) { clearInterval(typingIntervalRef.current); typingIntervalRef.current = null }
              sendTyping(false)
            }, 4000)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              editingMsg ? handleEdit() : handleSend()
            }
          }}
          placeholder="Type a message…"
          className="flex-1 resize-none bg-background text-primary rounded-xl px-4 py-2 text-sm outline-none border border-border focus:border-accent transition-colors duration-theme max-h-32 placeholder:text-muted"
        />
        {!body.trim() && !pendingFile && !editingMsg && (
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`p-2 rounded-xl transition-colors ${recording ? 'bg-red-500 text-white animate-pulse' : 'text-muted hover:text-accent hover:bg-secondary/30'}`}
            title={recording ? 'Stop recording' : 'Record voice message'}
          >
            <Mic size={18} />
          </button>
        )}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={editingMsg ? handleEdit : handleSend}
          disabled={loading || (!body.trim() && !pendingFile)}
          className="p-2 rounded-xl bg-cta text-cta-text hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          <Send size={18} />
        </motion.button>
      </div>
      {/* View Members modal */}
      <AnimatePresence>
        {showMembers && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowMembers(false)}
          >
            <motion.div
              className="bg-card border border-border rounded-card p-6 w-full max-w-sm shadow-[var(--shadow-card)]"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-primary font-semibold text-sm">Members</h3>
                <button onClick={() => setShowMembers(false)} className="text-muted hover:text-primary"><X size={16} /></button>
              </div>
              {membersLoading ? (
                <p className="text-xs text-muted text-center py-6">Loading…</p>
              ) : (
                <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
                  {members.map(m => (
                    <div key={m.profile_id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary/20">
                      <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
                        {m.profiles?.avatar_url
                          ? <img src={m.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          : (m.profiles?.display_name?.[0]?.toUpperCase() ?? '?')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-primary truncate">
                          {m.nickname
                            ? <><span className="font-medium">{m.nickname}</span> <span className="text-muted text-xs">({m.profiles?.display_name?.split(' ')[0]})</span></>
                            : m.profiles?.display_name?.split(' ')[0] ?? 'Unknown'}
                        </p>
                      </div>
                      {m.member_role === 'owner'
                        ? <span className="text-[10px] text-accent font-medium bg-accent/10 px-2 py-0.5 rounded-full flex-shrink-0">owner</span>
                        : <span className="text-[10px] text-highlight font-medium bg-highlight/10 px-2 py-0.5 rounded-full flex-shrink-0">member</span>
                      }
                    </div>
                  ))}

                  {pendingInvites.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 mt-2 mb-1">
                        <div className="flex-1 border-t border-border" />
                        <span className="text-[10px] text-muted uppercase tracking-wide">Pending</span>
                        <div className="flex-1 border-t border-border" />
                      </div>
                      {pendingInvites.map(inv => (
                        <div key={inv.to_id} className="flex items-center gap-3 px-2 py-2 rounded-lg opacity-60">
                          <div className="w-8 h-8 rounded-full bg-muted/20 text-muted flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
                            {inv.invitee?.avatar_url
                              ? <img src={inv.invitee.avatar_url} alt="" className="w-full h-full object-cover" />
                              : (inv.invitee?.display_name?.[0]?.toUpperCase() ?? '?')}
                          </div>
                          <p className="flex-1 text-sm text-muted truncate">{inv.invitee?.display_name ?? 'Unknown'}</p>
                          <span className="text-[10px] text-muted border border-border px-2 py-0.5 rounded-full">pending</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Member modal */}
      <AnimatePresence>
        {showAddMember && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowAddMember(false)}
          >
            <motion.div
              className="bg-card border border-border rounded-card p-6 w-full max-w-sm shadow-[var(--shadow-card)]"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-primary font-semibold text-sm">Add Member</h3>
                <button onClick={() => setShowAddMember(false)} className="text-muted hover:text-primary"><X size={16} /></button>
              </div>

              {/* Role toggle */}
              <div className="flex bg-background border border-border rounded-lg p-0.5 mb-3 w-fit">
                {(['student', 'teacher'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => { setAddMemberRole(r); loadAddMemberPeople(r, addMemberSearch) }}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                      addMemberRole === r ? 'bg-accent text-card' : 'text-muted hover:text-primary'
                    }`}
                  >
                    {r === 'teacher' ? 'Teacher' : 'Student'}
                  </button>
                ))}
              </div>

              {/* Search */}
              <input
                className="w-full bg-background border border-border text-primary rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-accent transition-colors placeholder:text-muted"
                placeholder={`Search ${addMemberRole}s…`}
                value={addMemberSearch}
                onChange={e => { setAddMemberSearch(e.target.value); loadAddMemberPeople(addMemberRole, e.target.value) }}
              />

              {/* People list */}
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                {addMemberPeople.length === 0 && (
                  <p className="text-xs text-muted text-center py-4">No {addMemberRole}s found</p>
                )}
                {addMemberPeople.map(person => {
                  const isMember  = members.some(m => m.profile_id === person.id)
                  const isPending = !isMember && invitedIds.has(person.id)
                  const isBlocked = isMember || isPending
                  return (
                    <div key={person.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary/20">
                      <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
                        {person.avatar_url
                          ? <img src={person.avatar_url} alt="" className="w-full h-full object-cover" />
                          : (person.display_name?.[0]?.toUpperCase() ?? '?')}
                      </div>
                      <span className="flex-1 text-sm text-primary truncate">{person.display_name ?? 'Unknown'}</span>
                      {isMember ? (
                        <span className="text-[10px] text-highlight font-medium bg-highlight/10 px-2 py-0.5 rounded-full flex-shrink-0">member</span>
                      ) : isPending ? (
                        <span className="text-[10px] text-muted border border-border px-2 py-0.5 rounded-full flex-shrink-0">invited</span>
                      ) : (
                        <button
                          onClick={() => handleInvite(person)}
                          disabled={inviting === person.id}
                          className="p-1.5 rounded-lg bg-cta text-cta-text hover:opacity-80 disabled:opacity-50 transition-colors flex-shrink-0"
                          title="Send invite"
                        >
                          <UserPlus size={13} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Set Nicknames modal */}
      <AnimatePresence>
        {showNicknames && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowNicknames(false)}
          >
            <motion.div
              className="bg-card border border-border rounded-card p-6 w-full max-w-sm shadow-[var(--shadow-card)]"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-primary font-semibold text-sm">Set Nicknames</h3>
                <button onClick={() => setShowNicknames(false)} className="text-muted hover:text-primary"><X size={16} /></button>
              </div>
              <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
                {membersLoading
                  ? <p className="text-xs text-muted text-center py-6">Loading…</p>
                  : members.map(m => (
                    <div key={m.profile_id} className="flex flex-col px-2 py-2 rounded-lg hover:bg-secondary/20">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
                          {m.profiles?.avatar_url
                            ? <img src={m.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                            : (m.profiles?.display_name?.[0]?.toUpperCase() ?? '?')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-primary truncate">
                            {m.nickname
                              ? <><span className="font-medium">{m.nickname}</span> <span className="text-muted text-xs">({m.profiles?.display_name?.split(' ')[0]})</span></>
                              : m.profiles?.display_name?.split(' ')[0] ?? 'Unknown'}
                          </p>
                        </div>
                        <button
                          onClick={() => { setEditingNickname(editingNickname === m.profile_id ? null : m.profile_id); setNicknameInput(m.nickname ?? '') }}
                          className="text-[10px] text-muted hover:text-accent underline flex-shrink-0 transition-colors"
                        >
                          {m.nickname ? 'edit' : 'set'}
                        </button>
                      </div>
                      {editingNickname === m.profile_id && (
                        <div className="flex gap-1.5 mt-2 ml-11">
                          <input
                            autoFocus
                            className="flex-1 bg-background border border-border text-primary rounded-lg px-2 py-1 text-xs outline-none focus:border-accent transition-colors placeholder:text-muted"
                            placeholder="Nickname (blank to clear)"
                            value={nicknameInput}
                            onChange={e => setNicknameInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveNickname(m.profile_id); if (e.key === 'Escape') setEditingNickname(null) }}
                          />
                          <button onClick={() => handleSaveNickname(m.profile_id)} className="px-2 py-1 bg-cta text-cta-text rounded-lg text-xs hover:opacity-90">Save</button>
                          <button onClick={() => setEditingNickname(null)} className="px-2 py-1 border border-border text-muted rounded-lg text-xs hover:text-primary">✕</button>
                        </div>
                      )}
                    </div>
                  ))
                }
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename modal */}
      <AnimatePresence>
        {renaming && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setRenaming(false)}
          >
            <motion.div
              className="bg-card border border-border rounded-card p-6 w-full max-w-sm shadow-[var(--shadow-card)]"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-primary font-semibold text-sm mb-4">Rename Group</h3>
              <input
                autoFocus
                className="w-full bg-background border border-border text-primary rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-accent transition-colors"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
                placeholder="New group name"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setRenaming(false)}
                  className="flex-1 py-2 text-sm text-muted border border-border rounded-lg hover:bg-secondary/30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRename}
                  disabled={!renameValue.trim()}
                  className="flex-1 py-2 text-sm bg-cta text-cta-text rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Avatar crop modal */}
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          onDone={handleCropDone}
          onClose={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null) }}
        />
      )}
    </div>
  )
}
