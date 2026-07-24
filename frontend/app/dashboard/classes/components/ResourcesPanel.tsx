'use client'

import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  FileText, Image as ImageIcon, Play, Music, File, ExternalLink,
  Link2, Upload, Trash2, X, Download, Circle, CheckCircle2
} from 'lucide-react'
import { getCourseResources, uploadResource, deleteResource, type CourseResource } from '@/app/lib/classesApi'

type Props = {
  token: string
  courseId: number
  role: 'teacher' | 'student'
  userId: string
}

const MAX_BYTES = 2_147_483_648 // 2 GB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`
}

const LS_KEY = (userId: string, resourceId: number) =>
  `resource_done_${userId}_${resourceId}`

function isCompleted(userId: string, resourceId: number): boolean {
  try {
    return localStorage.getItem(LS_KEY(userId, resourceId)) === '1'
  } catch { return false }
}

function toggleCompleted(userId: string, resourceId: number): boolean {
  try {
    const key = LS_KEY(userId, resourceId)
    const next = localStorage.getItem(key) !== '1'
    if (next) localStorage.setItem(key, '1')
    else       localStorage.removeItem(key)
    return next
  } catch { return false }
}

function ResourceIcon({ type }: { type: string }) {
  const cls = 'h-5 w-5 flex-shrink-0'
  switch (type) {
    case 'pdf':          return <FileText className={`${cls} text-red-500`} />
    case 'image':        return <ImageIcon className={`${cls} text-blue-500`} />
    case 'video':        return <Play className={`${cls} text-purple-500`} />
    case 'audio':        return <Music className={`${cls} text-green-500`} />
    case 'presentation': return <FileText className={`${cls} text-orange-500`} />
    case 'document':     return <FileText className={`${cls} text-blue-400`} />
    case 'drive_link':   return <ExternalLink className={`${cls} text-emerald-500`} />
    case 'external_link':return <Link2 className={`${cls} text-gray-500`} />
    default:             return <File className={`${cls} text-gray-400`} />
  }
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    pdf: 'bg-red-100 text-red-700',
    image: 'bg-blue-100 text-blue-700',
    video: 'bg-purple-100 text-purple-700',
    audio: 'bg-green-100 text-green-700',
    presentation: 'bg-orange-100 text-orange-700',
    document: 'bg-blue-100 text-blue-600',
    drive_link: 'bg-emerald-100 text-emerald-700',
    external_link: 'bg-gray-100 text-gray-700',
    other: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${colors[type] || colors.other}`}>
      {type.replace('_', ' ')}
    </span>
  )
}

function UploadModal({ token, courseId, onClose, onSuccess }: { token: string; courseId: number; onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    if (!title.trim()) { setError('Title is required'); return }
    if (!file) { setError('Select a file'); return }
    if (file.size > MAX_BYTES) { setError('File exceeds 2 GB limit. Compress or use a Drive link.'); return }

    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', title.trim())
    if (description) fd.append('description', description)

    setUploadPct(0)
    setError('')
    try {
      await uploadResource(token, courseId, fd, pct => setUploadPct(pct))
      onSuccess()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setUploadPct(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
      <div className="relative w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted hover:text-primary"><X className="h-5 w-5" /></button>
        <h2 className="font-display text-base font-bold text-text-primary mb-4">Upload Resource</h2>
        {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
        <div className="space-y-3">
          <div
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 cursor-pointer hover:border-accent transition"
          >
            {file ? (
              <>
                <FileText className="h-8 w-8 text-accent mb-2" />
                <p className="text-sm font-medium text-text-primary">{file.name}</p>
                <p className="text-xs text-muted">{formatBytes(file.size)}</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted mb-2" />
                <p className="text-sm text-muted">Drop file here or click to browse</p>
                <p className="text-xs text-muted mt-0.5">PDF, Images, Video, Audio, Documents · Up to 2 GB</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) { setFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, '')) }
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Title *</label>
            <input className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none" value={title} onChange={e => setTitle(e.target.value)} placeholder="Lecture 1 Notes" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Description</label>
            <textarea className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          {uploadPct !== null && (
            <div>
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>Uploading{file ? ` ${file.name}` : ''}…</span>
                <span>{uploadPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-border overflow-hidden">
                <div className="h-2 rounded-full bg-primary transition-all duration-200" style={{ width: `${uploadPct}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted hover:border-primary hover:text-primary transition">Cancel</button>
          <button onClick={handleUpload} disabled={uploadPct !== null} className="rounded-xl bg-cta px-5 py-2 text-sm font-semibold text-cta-text hover:opacity-90 transition disabled:opacity-60">
            {uploadPct !== null ? `${uploadPct}%` : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LinkModal({ token, courseId, onClose, onSuccess }: { token: string; courseId: number; onClose: () => void; onSuccess: () => void }) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!url.trim()) { setError('URL is required'); return }
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')
    const fd = new FormData()
    fd.append('title', title.trim())
    fd.append('external_url', url.trim())
    if (description) fd.append('description', description)
    try {
      await uploadResource(token, courseId, fd)
      onSuccess()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save link')
    }
    setSaving(false)
  }

  const isDrive = url.includes('drive.google.com') || url.includes('docs.google.com')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
      <div className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted hover:text-primary"><X className="h-5 w-5" /></button>
        <h2 className="font-display text-base font-bold text-text-primary mb-4">Add External Link</h2>
        {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">URL *</label>
            <input className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
            {isDrive && <p className="text-xs text-emerald-600 mt-1">Detected: Google Drive / Docs link</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Title *</label>
            <input className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none" value={title} onChange={e => setTitle(e.target.value)} placeholder="Lecture Slides" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Description</label>
            <input className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted hover:border-primary hover:text-primary transition">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="rounded-xl bg-cta px-5 py-2 text-sm font-semibold text-cta-text hover:opacity-90 transition disabled:opacity-60">
            {saving ? 'Saving…' : 'Add Link'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ResourcesPanel({ token, courseId, role, userId }: Props) {
  const [resources, setResources] = useState<CourseResource[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [showLink, setShowLink] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [done, setDone] = useState<Set<number>>(new Set())

  const load = async () => {
    setLoading(true)
    try {
      const res = await getCourseResources(token, courseId)
      setResources(res.resources || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [courseId])

  // Populate done set from localStorage after resources load
  useEffect(() => {
    if (resources.length === 0) return
    const s = new Set<number>()
    for (const r of resources) {
      if (isCompleted(userId, r.resource_id)) s.add(r.resource_id)
    }
    setDone(s)
  }, [resources, userId])

  function handleToggleDone(resourceId: number) {
    const next = toggleCompleted(userId, resourceId)
    setDone(prev => {
      const s = new Set(prev)
      if (next) s.add(resourceId)
      else       s.delete(resourceId)
      return s
    })
  }

  async function handleDelete(r: CourseResource) {
    if (!confirm(`Delete "${r.title}"?`)) return
    setDeleting(r.resource_id)
    try {
      await deleteResource(token, courseId, r.resource_id)
      setResources(prev => prev.filter(x => x.resource_id !== r.resource_id))
    } catch {}
    setDeleting(null)
  }

  const isLink = (r: CourseResource) => r.resource_type === 'drive_link' || r.resource_type === 'external_link'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">{resources.length} resource{resources.length !== 1 ? 's' : ''}</span>
        {role === 'teacher' && (
          <div className="flex gap-2">
            <button onClick={() => setShowLink(true)} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:border-primary hover:text-primary transition">
              <Link2 className="h-3.5 w-3.5" /> Add Link
            </button>
            <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 rounded-xl bg-cta px-3 py-1.5 text-xs font-semibold text-cta-text hover:opacity-90 transition">
              <Upload className="h-3.5 w-3.5" /> Upload File
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-border" />)}
        </div>
      ) : resources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <FileText className="h-8 w-8 text-border mx-auto mb-2" />
          <p className="text-sm text-muted">No resources yet.</p>
          {role === 'teacher' && <p className="text-xs text-muted mt-1">Upload files or add links for your students.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {resources.map(r => {
              const isDone = done.has(r.resource_id)
              return (
                <motion.div
                  key={r.resource_id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 hover:border-accent/40 transition ${
                    isDone
                      ? 'border-emerald-200 bg-emerald-50/40 border-l-4 border-l-emerald-400 opacity-70'
                      : 'border-border bg-card'
                  }`}
                >
                  <ResourceIcon type={r.resource_type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-medium truncate ${isDone ? 'line-through text-muted' : 'text-text-primary'}`}>{r.title}</p>
                      <TypeBadge type={r.resource_type} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted">
                      {r.file_size_bytes !== null && <span>{formatBytes(r.file_size_bytes)}</span>}
                      <span>{new Date(r.uploaded_at).toLocaleDateString()}</span>
                      <span>{r.download_count} downloads</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isLink(r) ? (
                      <a
                        href={r.external_url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:border-accent hover:text-accent transition"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Open
                      </a>
                    ) : r.file_url ? (
                      <a
                        href={r.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={r.file_name || true}
                        className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:border-accent hover:text-accent transition"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                    ) : null}

                    {/* Mark as Completed toggle */}
                    <button
                      onClick={() => handleToggleDone(r.resource_id)}
                      title={isDone ? 'Mark as not completed' : 'Mark as completed'}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                        isDone
                          ? 'text-emerald-600 hover:text-emerald-700'
                          : 'text-muted hover:text-emerald-600'
                      }`}
                    >
                      {isDone
                        ? <CheckCircle2 className="h-4 w-4" />
                        : <Circle className="h-4 w-4" />
                      }
                      <span className="hidden sm:inline">{isDone ? 'Completed' : 'Mark done'}</span>
                    </button>

                    {role === 'teacher' && (
                      <button
                        onClick={() => handleDelete(r)}
                        disabled={deleting === r.resource_id}
                        className="text-red-400 hover:text-red-600 transition disabled:opacity-50 p-1"
                        title="Delete resource"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {showUpload && <UploadModal token={token} courseId={courseId} onClose={() => setShowUpload(false)} onSuccess={load} />}
      {showLink && <LinkModal token={token} courseId={courseId} onClose={() => setShowLink(false)} onSuccess={load} />}
    </div>
  )
}
