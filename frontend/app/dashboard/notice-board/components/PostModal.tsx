'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  BookOpen,
  Building,
  Bus,
  CalendarDays,
  Megaphone,
  Paperclip,
  Plus,
  X,
} from 'lucide-react'
import {
  type NoticePost,
  createNotice,
  createPoll,
  updateNotice,
  uploadAttachment,
} from '@/app/lib/noticeApi'
import { useNotifications } from '@/app/context/NotificationContext'

const CATEGORIES = [
  { key: 'academics_exams', label: 'Academics & Exams', Icon: BookOpen },
  { key: 'general', label: 'General', Icon: Megaphone },
  { key: 'hall_info', label: 'Hall Info', Icon: Building },
  { key: 'transport', label: 'Transport', Icon: Bus },
  { key: 'emergency', label: 'Emergency', Icon: AlertTriangle },
  { key: 'upcoming_events', label: 'Upcoming Events', Icon: CalendarDays },
]

type PostModalProps = {
  open: boolean
  onClose: () => void
  token: string
  userRole: string
  editData?: NoticePost | null
  onSuccess: (notice: NoticePost) => void
}

export default function PostModal({ open, onClose, token, userRole, editData, onSuccess }: PostModalProps) {
  const { addNotification } = useNotifications()
  const [category, setCategory] = useState('general')
  const [audience, setAudience] = useState('all')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [hasPoll, setHasPoll] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [isMultiple, setIsMultiple] = useState(false)
  const [pollEndsAt, setPollEndsAt] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editData) {
      setCategory(editData.category)
      setAudience(editData.audience)
      setTitle(editData.title)
      setContent(editData.content)
    } else {
      setCategory('general')
      setAudience('all')
      setTitle('')
      setContent('')
    }
    setHasPoll(false)
    setPollQuestion('')
    setPollOptions(['', ''])
    setIsMultiple(false)
    setPollEndsAt('')
    setSelectedFiles([])
    setError('')
  }, [editData, open])

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  function addOption() {
    if (pollOptions.length < 6) setPollOptions(prev => [...prev, ''])
  }

  function removeOption(idx: number) {
    if (pollOptions.length > 2) setPollOptions(prev => prev.filter((_, i) => i !== idx))
  }

  function updateOption(idx: number, value: string) {
    setPollOptions(prev => prev.map((o, i) => (i === idx ? value : o)))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)])
    }
  }

  function removeFile(idx: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('Title is required.'); return }
    setError('')
    setSubmitting(true)
    try {
      let notice: NoticePost
      if (editData) {
        notice = await updateNotice(editData.id, { title: title.trim(), content, category, audience }, token)
      } else {
        notice = await createNotice({ title: title.trim(), content, category, audience }, token)
      }

      if (hasPoll && !editData) {
        const validOptions = pollOptions.map(o => o.trim()).filter(Boolean)
        if (validOptions.length >= 2 && pollQuestion.trim()) {
          await createPoll(notice.id, {
            question: pollQuestion.trim(),
            options: validOptions,
            is_multiple: isMultiple,
            ends_at: pollEndsAt || undefined,
          }, token)
          notice = { ...notice, has_poll: true }
        }
      }

      let uploadedCount = 0
      const failedFiles: string[] = []
      for (const file of selectedFiles) {
        try {
          await uploadAttachment(notice.id, file, token)
          uploadedCount++
        } catch {
          failedFiles.push(file.name)
        }
      }

      if (failedFiles.length > 0) {
        addNotification({
          type: 'system',
          title: 'Some media failed to upload',
          body: `Could not upload: ${failedFiles.join(', ')}. Make sure the "notice-attachments" storage bucket exists in Supabase.`,
          href: '/dashboard/notice-board',
        })
      }

      onSuccess({ ...notice, attachment_count: notice.attachment_count + uploadedCount })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to post. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-card border border-border shadow-2xl"
          >
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <h2 className="text-lg font-semibold text-text-primary">
                {editData ? 'Edit Post' : 'New Post'}
              </h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-text-muted transition hover:bg-accent/10 hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              {/* Category selector */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Category</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCategory(key)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                        category === key
                          ? 'border-primary bg-primary text-white'
                          : 'border-border text-text-muted hover:border-primary hover:text-primary'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audience selector */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Audience</p>
                <div className="flex gap-2">
                  {[
                    { key: 'all', label: 'Everyone' },
                    { key: 'students', label: 'Students' },
                    { key: 'teachers', label: 'Teachers Only', teacherOnly: true },
                  ].map(({ key, label, teacherOnly }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAudience(key)}
                      disabled={teacherOnly && userRole !== 'teacher'}
                      className={`rounded-full border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        audience === key
                          ? 'border-primary bg-primary text-white'
                          : 'border-border text-text-muted hover:border-primary hover:text-primary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title input */}
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Post title..."
                maxLength={255}
                className="w-full rounded-xl border border-border bg-transparent px-4 py-3 text-lg font-medium text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />

              {/* Content textarea */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleContentChange}
                placeholder="Share something with the university..."
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-transparent px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ minHeight: '80px' }}
              />

              {/* Poll section */}
              {!editData && (
                <div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHasPoll(p => !p)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                        hasPoll
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-text-muted hover:border-primary hover:text-primary'
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {hasPoll ? 'Remove Poll' : 'Add Poll'}
                    </button>
                  </div>

                  {hasPoll && (
                    <div className="mt-3 space-y-3 rounded-xl border border-border bg-card/50 p-4">
                      <input
                        type="text"
                        value={pollQuestion}
                        onChange={e => setPollQuestion(e.target.value)}
                        placeholder="Poll question..."
                        className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
                      />
                      <div className="space-y-2">
                        {pollOptions.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={opt}
                              onChange={e => updateOption(idx, e.target.value)}
                              placeholder={`Option ${idx + 1}`}
                              className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
                            />
                            {pollOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() => removeOption(idx)}
                                className="rounded p-1 text-text-muted hover:text-red-500"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {pollOptions.length < 6 && (
                          <button
                            type="button"
                            onClick={addOption}
                            className="flex items-center gap-1 text-xs text-primary transition hover:underline"
                          >
                            <Plus className="h-3 w-3" />
                            Add option
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-text-primary">
                          <input
                            type="checkbox"
                            checked={isMultiple}
                            onChange={e => setIsMultiple(e.target.checked)}
                            className="rounded"
                          />
                          Allow multiple choices
                        </label>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-text-muted">Ends at:</label>
                          <input
                            type="datetime-local"
                            value={pollEndsAt}
                            onChange={e => setPollEndsAt(e.target.value)}
                            className="rounded-lg border border-border bg-transparent px-2 py-1 text-sm text-text-primary focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* File attachments */}
              <div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-text-muted transition hover:border-primary hover:text-primary"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Attach files
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                    accept="image/*,application/pdf,text/plain,text/markdown,.md,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/mp4,audio/*"
                  />
                </div>
                {selectedFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-text-primary"
                      >
                        <span className="max-w-[120px] truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="text-text-muted hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-border-subtle pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-text-muted transition hover:bg-accent/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
                >
                  {submitting ? 'Posting…' : editData ? 'Save changes' : 'Post'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
