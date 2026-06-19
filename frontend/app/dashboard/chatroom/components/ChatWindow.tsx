'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Paperclip, X, Mic, Square, MoreVertical, Copy, Check, Trash2, LogOut } from 'lucide-react'
import {
  getMessages, sendMessage, editMessage, deleteMessage,
  uploadChatAttachment, addReaction, removeReaction, markRead, deleteRoom,
  type ChatMessage, type ReactionType,
} from '@/app/lib/chatApi'
import { useChatRealtime } from '../useChatRealtime'
import MessageBubble from './MessageBubble'

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
}

export default function ChatWindow({ roomId, roomType, roomTitle, roomAvatar, roomCode, roomCreatedBy, currentUserId, currentUserName, currentUserAvatar, token, onNewMessage, onRoomDeleted }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const replyToRef = useRef<ChatMessage | null>(null)
  const setReplyToSync = useCallback((msg: ChatMessage | null) => {
    replyToRef.current = msg
    setReplyTo(msg)
  }, [])
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const shouldScrollRef = useRef(true) // only scroll to bottom for new messages, not history loads
  // Cache sender profiles so realtime messages can show the correct name/avatar
  const profileCache = useRef<Record<string, { display_name: string | null; avatar_url: string | null }>>({})
  // Seed own profile immediately
  profileCache.current[currentUserId] = { display_name: currentUserName, avatar_url: currentUserAvatar ?? null }

  const [fetchError, setFetchError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
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
        // Loading older messages — preserve scroll position
        shouldScrollRef.current = false
        const container = scrollRef.current
        const prevHeight = container?.scrollHeight ?? 0
        setMessages(prev => [...prev, ...enriched])
        // Restore scroll position after DOM updates
        requestAnimationFrame(() => {
          if (container) container.scrollTop = container.scrollHeight - prevHeight
          shouldScrollRef.current = true
        })
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

  useEffect(() => {
    if (!shouldScrollRef.current || !scrollRef.current) return
    const el = scrollRef.current
    // Double RAF: first lets React flush, second lets browser paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    })
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

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Conversation header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0">
          {roomAvatar
            ? <img src={roomAvatar} alt="" className="w-full h-full object-cover" />
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
                {roomType === 'group' && roomCode && (
                  <button
                    onClick={() => { copyRoomCode(); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-primary hover:bg-secondary/30 transition-colors"
                  >
                    <Copy size={13} /> Copy room code
                  </button>
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
              {/* Avatar slot — same w-8 fixed width as MessageBubble */}
              <div className="flex-shrink-0 w-8">
                {(() => {
                  const t = typers[0]
                  const avatarUrl = t.avatarUrl ?? profileCache.current[t.userId]?.avatar_url
                  const initial = (t.displayName ?? '?')[0]?.toUpperCase()
                  return avatarUrl ? (
                    <img src={avatarUrl} alt={t.displayName ?? ''}
                      className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">
                      {initial}
                    </div>
                  )
                })()}
              </div>
              {/* Bubble — bg-card border border-border, same as incoming text bubble */}
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
    </div>
  )
}
