'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, FileText, Pencil, Trash2 } from 'lucide-react'
import {
  type Attachment,
  type NoticePost,
  type PollData,
  type Reaction,
  castVote,
  getAttachments,
  getPoll,
  getReactions,
  removeReaction,
  upsertReaction,
} from '@/app/lib/noticeApi'

const REACTIONS = [
  { key: 'like', emoji: '👍', label: 'Like' },
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'haha', emoji: '😂', label: 'Haha' },
  { key: 'wow', emoji: '😮', label: 'Wow' },
  { key: 'sad', emoji: '😢', label: 'Sad' },
  { key: 'angry', emoji: '😠', label: 'Angry' },
  { key: 'fire', emoji: '🔥', label: 'Fire' },
  { key: 'clap', emoji: '👏', label: 'Clap' },
  { key: 'think', emoji: '🤔', label: 'Think' },
  { key: 'party', emoji: '🎉', label: 'Party' },
]

const CATEGORY_CONFIG: Record<string, { label: string; className: string }> = {
  academics_exams: { label: 'Academics & Exams', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
  general: { label: 'General', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400' },
  hall_info: { label: 'Hall Info', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' },
  transport: { label: 'Transport', className: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  emergency: { label: 'Emergency', className: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
  upcoming_events: { label: 'Upcoming Events', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

type NoticeCardProps = {
  notice: NoticePost
  currentUserId: string
  token: string
  onEdit?: (notice: NoticePost) => void
  onDelete?: (id: string) => void
}

export default function NoticeCard({ notice, currentUserId, token, onEdit, onDelete }: NoticeCardProps) {
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [pollData, setPollData] = useState<PollData | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [reacting, setReacting] = useState(false)
  const [voting, setVoting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [rxns, atts] = await Promise.all([
          getReactions(notice.id, token),
          notice.attachment_count > 0 ? getAttachments(notice.id, token) : Promise.resolve([]),
        ])
        if (!cancelled) {
          setReactions(rxns)
          setAttachments(atts)
        }
        if (notice.has_poll && !cancelled) {
          const pd = await getPoll(notice.id, token)
          if (!cancelled) setPollData(pd)
        }
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [notice.id, notice.attachment_count, notice.has_poll, token])

  const reactionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of reactions) counts[r.reaction] = (counts[r.reaction] ?? 0) + 1
    return counts
  }, [reactions])

  const myReaction = reactions.find(r => r.user_id === currentUserId)?.reaction ?? null

  async function handleReact(key: string) {
    if (reacting) return
    setReacting(true)
    try {
      if (myReaction === key) {
        await removeReaction(notice.id, token)
        setReactions(prev => prev.filter(r => r.user_id !== currentUserId))
      } else {
        await upsertReaction(notice.id, key, token)
        setReactions(prev => [
          ...prev.filter(r => r.user_id !== currentUserId),
          { reaction: key, user_id: currentUserId },
        ])
      }
    } catch {}
    setReacting(false)
  }

  async function handleVote(optionId: string) {
    if (voting || !pollData) return
    setVoting(true)
    try {
      await castVote(notice.id, optionId, token)
      setPollData(prev => {
        if (!prev) return prev
        const newCounts = { ...prev.vote_counts }
        if (!prev.poll.is_multiple) {
          for (const prevId of prev.my_votes) {
            newCounts[prevId] = Math.max(0, (newCounts[prevId] ?? 0) - 1)
          }
          return {
            ...prev,
            vote_counts: { ...newCounts, [optionId]: (newCounts[optionId] ?? 0) + 1 },
            my_votes: [optionId],
          }
        }
        return {
          ...prev,
          vote_counts: { ...newCounts, [optionId]: (newCounts[optionId] ?? 0) + 1 },
          my_votes: [...prev.my_votes, optionId],
        }
      })
    } catch {}
    setVoting(false)
  }

  const isOwner = notice.author_id === currentUserId
  const catConfig = CATEGORY_CONFIG[notice.category] ?? CATEGORY_CONFIG.general
  const authorInitials = getInitials(notice.author_name ?? 'U')
  const contentShort = notice.content.length > 300
  const displayContent = expanded || !contentShort ? notice.content : notice.content.slice(0, 300) + '…'

  const images = attachments.filter(a => a.file_type === 'image')
  const audios = attachments.filter(a => a.file_type === 'audio' || a.file_type === 'mp3')
  const videos = attachments.filter(a => a.file_type === 'mp4')
  const files = attachments.filter(a => !['image', 'audio', 'mp3', 'mp4'].includes(a.file_type))

  const totalPollVotes = pollData
    ? Object.values(pollData.vote_counts).reduce((a, b) => a + b, 0)
    : 0

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] space-y-4">
      {/* Author row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-cta text-sm font-semibold text-cta-text">
            {notice.author_avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={notice.author_avatar} alt={notice.author_name} className="h-full w-full object-cover" />
            ) : (
              authorInitials
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold text-text-primary">{notice.author_name}</span>
              {notice.author_role === 'teacher' && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Teacher</span>
              )}
              {notice.author_role === 'student' && (
                <span className="rounded-full bg-highlight/10 px-2 py-0.5 text-xs text-highlight">Student</span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${catConfig.className}`}>
                {catConfig.label}
              </span>
              {notice.audience === 'teachers' && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  Teachers Only
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <span className="text-xs text-text-muted">{formatTime(notice.created_at)}</span>
          {notice.is_edited && (
            <span className="text-xs text-text-muted">(edited)</span>
          )}
        </div>
      </div>

      {/* Title + content */}
      <div>
        <h3 className="mb-1.5 text-lg font-semibold text-text-primary">{notice.title}</h3>
        {notice.content && (
          <div>
            <p className="whitespace-pre-wrap text-sm text-text-primary">{displayContent}</p>
            {contentShort && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="mt-1 text-xs font-medium text-primary transition hover:underline"
              >
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Images */}
      {images.length > 0 && (
        <div className="flex flex-col gap-2">
          {images.map(img => (
            <a key={img.id} href={img.file_url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.file_url}
                alt={img.file_name}
                className="max-w-full cursor-pointer rounded-xl transition hover:opacity-90"
              />
            </a>
          ))}
        </div>
      )}

      {/* Video */}
      {videos.map(v => (
        <video
          key={v.id}
          src={v.file_url}
          controls
          className="w-full max-h-64 rounded-xl"
        />
      ))}

      {/* Audio */}
      {audios.map(a => (
        <div key={a.id} className="rounded-xl border border-border bg-card/50 p-3">
          <p className="mb-1.5 text-xs font-medium text-text-muted">{a.file_name}</p>
          <audio controls className="w-full rounded-lg" src={a.file_url} />
        </div>
      ))}

      {/* File chips */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map(f => (
            <a
              key={f.id}
              href={f.file_url}
              download={f.file_name}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-border bg-card/50 px-3 py-2 text-sm transition hover:bg-accent/5"
            >
              <FileText className="h-4 w-4 flex-shrink-0 text-text-muted" />
              <span className="max-w-[180px] truncate text-text-primary">{f.file_name}</span>
              {f.file_size && (
                <span className="text-xs text-text-muted">{formatFileSize(f.file_size)}</span>
              )}
              <Download className="h-3.5 w-3.5 flex-shrink-0 text-text-muted" />
            </a>
          ))}
        </div>
      )}

      {/* Poll */}
      {pollData && (
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
          <p className="font-semibold text-text-primary">{pollData.poll.question}</p>
          <div className="space-y-2">
            {pollData.options.map(option => {
              const count = pollData.vote_counts[option.id] ?? 0
              const pct = totalPollVotes > 0 ? Math.round((count / totalPollVotes) * 100) : 0
              const voted = pollData.my_votes.includes(option.id)
              const pollEnded = pollData.poll.ends_at && new Date(pollData.poll.ends_at) < new Date()
              return (
                <div key={option.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <button
                      onClick={() => handleVote(option.id)}
                      disabled={voting || !!pollEnded || (!!voted && !pollData.poll.is_multiple)}
                      className={`flex items-center gap-2 text-left transition ${
                        voted
                          ? 'font-semibold text-primary'
                          : 'text-text-primary hover:text-primary disabled:cursor-default'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                          voted ? 'border-primary bg-primary' : 'border-border'
                        }`}
                      >
                        {voted && <span className="h-2 w-2 rounded-full bg-white" />}
                      </span>
                      {option.option_text}
                    </button>
                    <span className="ml-2 flex-shrink-0 text-xs text-text-muted">
                      {count} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>{totalPollVotes} vote{totalPollVotes !== 1 ? 's' : ''}</span>
            {pollData.poll.ends_at && (
              <span>
                {new Date(pollData.poll.ends_at) > new Date()
                  ? `Ends ${new Date(pollData.poll.ends_at).toLocaleDateString()}`
                  : 'Poll ended'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Reaction bar */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {REACTIONS.map(r => {
          const count = reactionCounts[r.key] ?? 0
          const isActive = myReaction === r.key
          return (
            <button
              key={r.key}
              onClick={() => handleReact(r.key)}
              disabled={reacting}
              title={r.label}
              className={`flex flex-shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition hover:bg-accent/5 disabled:cursor-wait ${
                isActive
                  ? 'border-primary bg-primary/5 font-semibold text-primary'
                  : 'border-border text-text-muted'
              }`}
            >
              <span>{r.emoji}</span>
              {count > 0 && <span className="text-xs">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border-subtle pt-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-cta text-[10px] font-semibold text-cta-text">
            {notice.author_avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={notice.author_avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              authorInitials
            )}
          </div>
          <span className="text-sm font-medium text-text-primary">{notice.author_name}</span>
          {isOwner && onEdit && (
            <button
              onClick={() => onEdit(notice)}
              className="flex items-center gap-1 text-xs text-primary transition hover:underline"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
          {isOwner && onDelete && (
            <button
              onClick={() => onDelete(notice.id)}
              className="flex items-center gap-1 text-xs text-red-500 transition hover:underline"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
