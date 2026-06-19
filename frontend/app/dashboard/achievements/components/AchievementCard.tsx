'use client'

import { useState, useRef, useEffect } from 'react'
import { Code, ExternalLink, BookOpen, Star, MessageCircle, ChevronDown, ChevronUp, Send, X } from 'lucide-react'
import { toggleReaction, postComment, rateAchievement, getComments, type AchievementComment } from '@/app/lib/achievementsApi'

type AchievementType = 'project' | 'certificate' | 'research_paper'

const EMOJIS = ['👍', '❤️', '🔥', '🎉', '🤩', '💡', '👏', '😮', '🏆', '💪'] as const
const EMOJI_LABELS: Record<string, string> = {
  '👍': 'Like', '❤️': 'Love', '🔥': 'Fire', '🎉': 'Celebrate', '🤩': 'Amaze',
  '💡': 'Insightful', '👏': 'Clap', '😮': 'Wow', '🏆': 'Award', '💪': 'Strong',
}

const TYPE_BADGE: Record<AchievementType, string> = {
  project: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  certificate: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  research_paper: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}
const TYPE_LABEL: Record<AchievementType, string> = {
  project: 'Project',
  certificate: 'Certificate',
  research_paper: 'Research Paper',
}

type Skill = { skill_name: string; category: string | null }

export type AchievementCardData = {
  id: number
  type: AchievementType
  title: string
  subtitle?: string | null
  description?: string | null
  thumbnailUrl?: string | null
  githubUrl?: string | null
  liveDemoUrl?: string | null
  scholarUrl?: string | null
  dateRange?: string | null
  skills?: Skill[]
  media?: { media_id: number; file_url: string; file_type: string; file_name: string }[]
  reactions?: Record<string, number>
  avgRating?: number | null
  commentCount?: number
  comments?: AchievementComment[]
  authorName?: string
  authorRole?: string
  authorDept?: string
  authorAvatar?: string | null
  relativeDate?: string
  isOwner?: boolean
  userId?: string
}

type Props = {
  data: AchievementCardData
  token: string
  currentDbUserId?: string
  currentUserName?: string
  currentUserAvatar?: string | null
  onEdit?: () => void
}

function formatRelative(iso: string): string {
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

export default function AchievementCard({ data, token, currentDbUserId, currentUserName, currentUserAvatar, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [localComments, setLocalComments] = useState<AchievementComment[]>(data.comments ?? [])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [reactions, setReactions] = useState<Record<string, number>>(data.reactions ?? {})
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set())
  const [avgRating, setAvgRating] = useState<number | null>(data.avgRating ?? null)
  const [ratingOpen, setRatingOpen] = useState(false)
  const [ratingHover, setRatingHover] = useState(0)
  const [myRating, setMyRating] = useState(0)
  const ratingRef = useRef<HTMLDivElement>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ratingRef.current && !ratingRef.current.contains(e.target as Node)) {
        setRatingOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (!commentsOpen || commentsLoaded) return
    getComments(token, data.type, data.id).then(({ comments }) => {
      setLocalComments(comments)
      setCommentsLoaded(true)
    }).catch(() => setCommentsLoaded(true))
  }, [commentsOpen, commentsLoaded, token, data.type, data.id])

  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0)

  async function handleReact(emoji: string) {
    const optimisticReacted = !myReactions.has(emoji)
    setMyReactions(prev => {
      const next = new Set(prev)
      if (next.has(emoji)) next.delete(emoji)
      else next.add(emoji)
      return next
    })
    setReactions(prev => ({
      ...prev,
      [emoji]: Math.max(0, (prev[emoji] ?? 0) + (optimisticReacted ? 1 : -1)),
    }))
    try {
      await toggleReaction(token, data.type, data.id, emoji)
    } catch {
      // revert
      setMyReactions(prev => {
        const next = new Set(prev)
        if (next.has(emoji)) next.delete(emoji)
        else next.add(emoji)
        return next
      })
      setReactions(prev => ({
        ...prev,
        [emoji]: Math.max(0, (prev[emoji] ?? 0) + (optimisticReacted ? -1 : 1)),
      }))
    }
  }

  async function handleRate(star: number) {
    setMyRating(star)
    setRatingOpen(false)
    try {
      const res = await rateAchievement(token, data.type, data.id, star)
      setAvgRating(res.avg_rating)
    } catch {}
  }

  async function handleComment() {
    if (!commentText.trim()) return
    setSubmittingComment(true)
    try {
      const newComment = await postComment(token, data.type, data.id, commentText.trim())
      // Attach current user info optimistically since backend returns raw row
      newComment.author_name = currentUserName
      newComment.author_avatar = currentUserAvatar ?? null
      setLocalComments(prev => [...prev, newComment])
      setCommentsLoaded(true)
      setCommentText('')
    } catch {}
    setSubmittingComment(false)
  }

  const desc = data.description ?? ''
  const isLong = desc.length > 180
  const displayDesc = isLong && !expanded ? desc.slice(0, 180) + '…' : desc

  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {data.authorAvatar ? (
            <img src={data.authorAvatar} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-sm font-semibold text-primary">
              {(data.authorName ?? '?').charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text-primary">{data.authorName ?? 'Unknown'}</span>
              {data.authorRole && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{data.authorRole}</span>
              )}
            </div>
            <p className="text-xs text-text-muted">
              {data.authorDept && `${data.authorDept} · `}{data.relativeDate ?? ''}
            </p>
          </div>
        </div>
        {data.isOwner && onEdit && (
          <button onClick={onEdit} className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-text-muted transition hover:border-primary hover:text-primary">
            Edit
          </button>
        )}
      </div>

      {/* Type badge */}
      <span className={`mb-3 inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${TYPE_BADGE[data.type]}`}>
        {TYPE_LABEL[data.type]}
      </span>

      {/* Content */}
      <div className="mb-3 flex gap-4">
        {data.thumbnailUrl && (
          <img
            src={data.thumbnailUrl}
            alt={data.title}
            className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="mb-1 text-base font-bold text-text-primary line-clamp-2">{data.title}</h3>
          {data.subtitle && <p className="mb-1 text-sm text-text-muted">{data.subtitle}</p>}
          {data.dateRange && <p className="text-xs text-text-muted">{data.dateRange}</p>}
          {data.skills && data.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {data.skills.slice(0, 5).map((s) => (
                <span key={s.skill_name} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {s.skill_name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {desc && (
        <div className="mb-3">
          <p className="text-sm text-text-primary">{displayDesc}</p>
          {isLong && (
            <button onClick={() => setExpanded(!expanded)} className="mt-1 text-xs font-medium text-primary hover:underline">
              {expanded ? 'see less' : '…see more'}
            </button>
          )}
        </div>
      )}

      {/* Action links */}
      <div className="mb-3 flex flex-wrap gap-2">
        {data.githubUrl && (
          <a href={data.githubUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition hover:border-primary hover:text-primary">
            <Code className="h-3.5 w-3.5" /> GitHub
          </a>
        )}
        {data.liveDemoUrl && (
          <a href={data.liveDemoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition hover:border-primary hover:text-primary">
            <ExternalLink className="h-3.5 w-3.5" /> Live Demo
          </a>
        )}
        {data.scholarUrl && (
          <a href={data.scholarUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition hover:border-primary hover:text-primary">
            <BookOpen className="h-3.5 w-3.5" /> Scholar
          </a>
        )}
      </div>

      {/* Media */}
      {data.media && data.media.length > 0 && (
        <div className={`mb-3 grid gap-2 ${data.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {data.media.map((m) =>
            m.file_type === 'image' ? (
              <button
                key={m.media_id}
                onClick={() => setLightbox(m.file_url)}
                className="overflow-hidden rounded-xl"
              >
                <img
                  src={m.file_url}
                  alt={m.file_name}
                  className="w-full rounded-xl object-cover transition hover:opacity-80"
                />
              </button>
            ) : (
              <a
                key={m.media_id}
                href={m.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center rounded-xl border border-border bg-background px-4 py-8 text-xs text-text-muted transition hover:border-primary hover:text-primary"
              >
                {m.file_name || m.file_type}
              </a>
            ),
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="mb-3 flex items-center gap-3 border-b border-t border-border py-2 text-xs text-text-muted">
        {avgRating != null && (
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            {avgRating.toFixed(1)}
          </span>
        )}
        {totalReactions > 0 && <span>{totalReactions} reaction{totalReactions !== 1 ? 's' : ''}</span>}
        <button onClick={() => setCommentsOpen(!commentsOpen)} className="ml-auto flex items-center gap-1 hover:text-primary">
          <MessageCircle className="h-3.5 w-3.5" />
          {localComments.length} comment{localComments.length !== 1 ? 's' : ''}
        </button>
      </div>

      {/* Emoji reaction row */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {EMOJIS.map((emoji) => {
          const active = myReactions.has(emoji)
          const count = reactions[emoji] ?? 0
          return (
            <button
              key={emoji}
              onClick={() => handleReact(emoji)}
              title={EMOJI_LABELS[emoji]}
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-sm transition ${
                active
                  ? 'ring-2 ring-primary bg-primary/10 font-semibold'
                  : 'border border-border bg-card hover:border-primary hover:bg-primary/5'
              }`}
            >
              {emoji}
              {count > 0 && <span className="text-xs text-text-muted">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Rate & Comment buttons */}
      <div className="mb-2 flex gap-2">
        <div className="relative" ref={ratingRef}>
          <button
            onClick={() => setRatingOpen(!ratingOpen)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-text-muted transition hover:border-primary hover:text-primary"
          >
            <Star className={`h-4 w-4 ${myRating > 0 ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            {myRating > 0 ? `Rated ${myRating}★` : 'Rate'}
          </button>
          {ratingOpen && (
            <div className="absolute bottom-full left-0 mb-2 flex gap-1 rounded-xl border border-border bg-card p-2 shadow-lg">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setRatingHover(star)}
                  onMouseLeave={() => setRatingHover(0)}
                  onClick={() => handleRate(star)}
                  className="text-xl transition hover:scale-110"
                >
                  <Star className={`h-6 w-6 ${star <= (ratingHover || myRating) ? 'fill-yellow-400 text-yellow-400' : 'text-text-muted'}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setCommentsOpen(!commentsOpen)}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-text-muted transition hover:border-primary hover:text-primary"
        >
          <MessageCircle className="h-4 w-4" />
          Comment
          {commentsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Comments section */}
      {commentsOpen && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {localComments.map((c) => {
            const name = c.author_name || 'User'
            const initial = name.charAt(0).toUpperCase()
            return (
              <div key={c.comment_id} className={`flex gap-2 ${c.parent_comment_id ? 'ml-8' : ''}`}>
                {c.author_avatar ? (
                  <img src={c.author_avatar} alt="" className="h-7 w-7 flex-shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary">
                    {initial}
                  </span>
                )}
                <div className="flex-1 rounded-xl bg-background p-3">
                  <p className="mb-0.5 text-xs font-semibold text-text-primary">{name}</p>
                  <p className="text-sm text-text-primary">{c.body}</p>
                  <p className="mt-1 text-xs text-text-muted">{formatRelative(c.created_at)}</p>
                </div>
              </div>
            )
          })}

          <div className="flex gap-2 pt-1">
            {currentUserAvatar ? (
              <img src={currentUserAvatar} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary">
                {(currentUserName ?? 'Me').charAt(0).toUpperCase()}
              </span>
            )}
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleComment()}
                placeholder="Write a comment…"
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <button
                onClick={handleComment}
                disabled={!commentText.trim() || submittingComment}
                className="text-primary transition disabled:opacity-40 hover:opacity-70"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 text-white" onClick={() => setLightbox(null)}>
            <X className="h-8 w-8" />
          </button>
          <img src={lightbox} alt="" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
