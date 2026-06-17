'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Send, Paperclip, X } from 'lucide-react'
import {
  getMessages, sendMessage, editMessage, deleteMessage,
  uploadChatAttachment, addReaction, removeReaction, markRead,
  type ChatMessage, type ReactionType,
} from '@/app/lib/chatApi'
import { useChatRealtime } from '../useChatRealtime'
import MessageBubble from './MessageBubble'

type Props = {
  roomId: string
  roomTitle: string | null
  roomAvatar?: string | null
  currentUserId: string
  currentUserName: string | null
  token: string
  onNewMessage?: (roomId: string, senderId: string, body: string | null, createdAt: string) => void
}

export default function ChatWindow({ roomId, roomTitle, roomAvatar, currentUserId, currentUserName, token, onNewMessage }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
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
  profileCache.current[currentUserId] = { display_name: currentUserName, avatar_url: null }

  const [fetchError, setFetchError] = useState('')

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

  useChatRealtime({
    roomId,
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
    setLoading(true)
    try {
      const msg = await sendMessage(roomId, { body: trimmed || undefined, reply_to: replyTo?.id, has_attachment: !!pendingFile }, token)
      onNewMessage?.(roomId, currentUserId, msg.body, msg.created_at)
      if (pendingFile) {
        const att = await uploadChatAttachment(msg.id, pendingFile, token)
        setMessages(prev => prev.map(m =>
          m.id === msg.id ? { ...m, attachments: [...m.attachments, att] } : m
        ))
        setPendingFile(null)
      }
      setBody('')
      setReplyTo(null)
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

  function startEdit(msg: ChatMessage) {
    setEditingMsg(msg)
    setBody(msg.body ?? '')
    setReplyTo(null)
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
        <span className="font-semibold text-sm text-primary truncate">{roomTitle ?? 'Chat'}</span>
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
            onReply={setReplyTo}
            onEdit={startEdit}
            onDelete={handleDelete}
            onReact={(id, r) => addReaction(id, r, token)}
            onUnreact={(id, r) => removeReaction(id, r, token)}
          />
        ))}
      </div>

      {/* Reply / Edit banner */}
      {(replyTo || editingMsg) && (
        <div className="px-4 py-2 bg-card border-t border-border flex items-center justify-between">
          <span className="text-xs text-accent font-medium">
            {editingMsg
              ? 'Editing message'
              : `Replying to: ${replyTo?.body?.slice(0, 60) ?? '(attachment)'}`}
          </span>
          <button onClick={() => { setReplyTo(null); setEditingMsg(null); setBody('') }}>
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
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              editingMsg ? handleEdit() : handleSend()
            }
          }}
          placeholder="Type a message…"
          className="flex-1 resize-none bg-background text-primary rounded-xl px-4 py-2 text-sm outline-none border border-border focus:border-accent transition-colors duration-theme max-h-32 placeholder:text-muted"
        />
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
