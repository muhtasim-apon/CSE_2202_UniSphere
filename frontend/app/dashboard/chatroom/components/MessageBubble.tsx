'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Reply, Edit2, Trash2, Smile, FileText, Image as ImageIcon, Music } from 'lucide-react'
import type { ChatMessage, ReactionType } from '@/app/lib/chatApi'

const REACTION_EMOJIS: Record<ReactionType, string> = {
  like: '👍', love: '❤️', haha: '😂', wow: '😮', sad: '😢',
  angry: '😠', fire: '🔥', clap: '👏', think: '🤔', party: '🎉',
}
const ALL_REACTIONS = Object.entries(REACTION_EMOJIS) as [ReactionType, string][]

type Props = {
  message: ChatMessage
  currentUserId: string
  grouped: boolean       // same sender as previous message
  groupedNext: boolean   // same sender as next message
  onReply: (msg: ChatMessage) => void
  onEdit: (msg: ChatMessage) => void
  onDelete: (msgId: string) => void
  onReact: (msgId: string, reaction: ReactionType) => void
  onUnreact: (msgId: string, reaction: ReactionType) => void
}

export default function MessageBubble({
  message, currentUserId, grouped, groupedNext, onReply, onEdit, onDelete, onReact, onUnreact,
}: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const [showTime, setShowTime] = useState(false)
  const isOwn = message.sender_id === currentUserId

  const reactionMap: Record<string, string[]> = {}
  for (const r of message.reactions) {
    reactionMap[r.reaction] = reactionMap[r.reaction] ?? []
    reactionMap[r.reaction].push(r.user_id)
  }
  const myReactions = new Set(
    message.reactions.filter(r => r.user_id === currentUserId).map(r => r.reaction)
  )

  const senderInitial = message.sender?.display_name?.[0]?.toUpperCase() ?? '?'
  const timeStr = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  // Bubble corner shape based on position in group
  // Own messages: tail on right side; others: tail on left side
  function bubbleShape() {
    if (isOwn) {
      if (!grouped && !groupedNext) return 'rounded-2xl rounded-tr-sm'             // single
      if (!grouped && groupedNext)  return 'rounded-2xl rounded-tr-sm rounded-br-sm' // first
      if (grouped && groupedNext)   return 'rounded-2xl rounded-r-sm'              // middle
      return 'rounded-2xl rounded-tr-sm'                                            // last → same as single
    } else {
      if (!grouped && !groupedNext) return 'rounded-2xl rounded-tl-sm'             // single
      if (!grouped && groupedNext)  return 'rounded-2xl rounded-tl-sm rounded-bl-sm' // first
      if (grouped && groupedNext)   return 'rounded-2xl rounded-l-sm'              // middle
      return 'rounded-2xl rounded-tl-sm'                                            // last → same as single
    }
  }

  return (
    <div
      className={`group flex gap-2 ${grouped ? 'mb-0.5' : 'mt-3 mb-0.5'} ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar — only shown for first in a group */}
      <div className="flex-shrink-0 w-8">
        {!grouped && (
          <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold overflow-hidden">
            {message.sender?.avatar_url
              ? <img src={message.sender.avatar_url} alt="" className="w-full h-full object-cover" />
              : senderInitial
            }
          </div>
        )}
      </div>

      <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>

        {/* Quoted reply */}
        {message.reply && (
          <div className="border-l-2 border-accent pl-2 mb-1 text-xs text-muted line-clamp-2 max-w-full">
            {message.reply.body ?? '(attachment)'}
          </div>
        )}

        {/* Bubble — only rendered if there's text */}
        {message.body && (
          <div
            onClick={() => setShowTime(t => !t)}
            className={`px-4 py-2 text-sm leading-relaxed cursor-pointer select-none ${bubbleShape()} ${
              isOwn
                ? 'bg-cta text-cta-text'
                : 'bg-card text-primary border border-border'
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
          </div>
        )}

        {/* Attachments — rendered outside the bubble */}
        {message.attachments.length > 0 && (
          <div className={`flex flex-col gap-0.5 ${message.body ? 'mt-0.5' : ''}`}>
            {message.attachments.map(att => {
              const isMedia = att.file_type === 'image' || att.file_type === 'mp4' || att.file_type === 'audio'
              if (isMedia) {
                if (att.file_type === 'image') return (
                  <img
                    key={att.id}
                    src={att.file_url}
                    alt={att.file_name}
                    className="max-w-[220px] rounded-xl border border-border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(att.file_url, '_blank')}
                  />
                )
                if (att.file_type === 'mp4') return (
                  <video
                    key={att.id}
                    src={att.file_url}
                    controls
                    className="max-w-[280px] rounded-xl border border-border shadow-sm"
                  />
                )
                if (att.file_type === 'audio') return (
                  <audio key={att.id} src={att.file_url} controls className="max-w-[260px]" />
                )
              }
              // Non-media: same bubble card as text messages
              return (
                <a
                  key={att.id}
                  href={att.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-4 py-2 text-sm hover:opacity-80 transition-opacity ${bubbleShape()} ${
                    isOwn ? 'bg-cta text-cta-text' : 'bg-card text-primary border border-border'
                  }`}
                >
                  <FileText size={14} className="flex-shrink-0" />
                  <span className="truncate max-w-[160px]">{att.file_name}</span>
                </a>
              )
            })}
          </div>
        )}

        {/* Timestamp — expands in on click with slow transition */}
        <motion.div
          initial={false}
          animate={{ height: showTime ? 'auto' : 0, opacity: showTime ? 1 : 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <span className={`block text-[10px] text-muted pt-1 pb-0.5 ${isOwn ? 'text-right' : 'text-left'}`}>
            {timeStr}{message.edited_at ? ' · edited' : ''}
          </span>
        </motion.div>

        {/* Reaction pills */}
        {Object.keys(reactionMap).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {Object.entries(reactionMap).map(([r, users]) => {
              const rk = r as ReactionType
              const mine = myReactions.has(r)
              return (
                <button
                  key={r}
                  onClick={() => mine ? onUnreact(message.id, rk) : onReact(message.id, rk)}
                  className={`flex items-center gap-0.5 text-xs rounded-full px-2 py-0.5 border transition-colors ${
                    mine
                      ? 'bg-accent/20 border-accent text-accent'
                      : 'bg-card border-border text-primary hover:border-accent'
                  }`}
                >
                  {REACTION_EMOJIS[rk]} {users.length}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Hover action buttons */}
      <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 self-center ${isOwn ? 'flex-row-reverse' : ''}`}>
        <button onClick={() => onReply(message)} className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-secondary/30 transition-colors" title="Reply">
          <Reply size={13} />
        </button>
        <div className="relative">
          <button
            onClick={() => setShowPicker(p => !p)}
            className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-secondary/30 transition-colors"
            title="React"
          >
            <Smile size={13} />
          </button>
          {showPicker && (
            <div className={`absolute bottom-full mb-1 bg-card border border-border rounded-xl p-2 flex flex-wrap gap-1 w-52 z-50 shadow-[var(--shadow-card)] ${isOwn ? 'right-0' : 'left-0'}`}>
              {ALL_REACTIONS.map(([r, emoji]) => (
                <button
                  key={r}
                  onClick={() => { setShowPicker(false); myReactions.has(r) ? onUnreact(message.id, r) : onReact(message.id, r) }}
                  className="text-lg hover:scale-125 transition-transform"
                  title={r}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        {isOwn && (
          <>
            <button onClick={() => onEdit(message)} className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-secondary/30 transition-colors" title="Edit">
              <Edit2 size={13} />
            </button>
            <button onClick={() => onDelete(message.id)} className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Delete">
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
