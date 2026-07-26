'use client'

import { useState, useRef } from 'react'
import { X, FileText, Upload, Plus, Trash2 } from 'lucide-react'
import { createPaper, updatePaper, uploadPaperMedia, type ResearchPaper } from '@/app/lib/achievementsApi'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1999 }, (_, i) => CURRENT_YEAR - i)

type Author = { author_name: string; author_order: number; is_corresponding: boolean }

type Props = {
  token: string
  currentUserName?: string
  onClose: () => void
  onSuccess: () => void
  paper?: ResearchPaper
}

export default function AddResearchPaperModal({ token, currentUserName = '', onClose, onSuccess, paper }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState(paper?.title || '')
  const [abstract, setAbstract] = useState(paper?.abstract || '')
  const [venueType, setVenueType] = useState<'journal' | 'conference'>(
    paper?.conference_name ? 'conference' : 'journal'
  )
  const [journalName, setJournalName] = useState(paper?.journal_name || '')
  const [conferenceName, setConferenceName] = useState(paper?.conference_name || '')
  const [doi, setDoi] = useState(paper?.doi || '')
  const [paperUrl, setPaperUrl] = useState(paper?.paper_url || '')
  const [scholarUrl, setScholarUrl] = useState(paper?.scholar_url || '')
  const [publishMonth, setPublishMonth] = useState(paper?.publish_month ? String(paper.publish_month) : '')
  const [publishYear, setPublishYear] = useState(paper?.publish_year ? String(paper.publish_year) : '')
  const [authors, setAuthors] = useState<Author[]>(
    paper?.authors && paper.authors.length > 0
      ? paper.authors
      : [{ author_name: currentUserName, author_order: 1, is_corresponding: true }]
  )
  const [skillNames, setSkillNames] = useState<string[]>(paper?.keywords?.map(k => k.skill_name) || [])
  const [skillInput, setSkillInput] = useState('')
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSkillKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' && e.key !== ',') return
    e.preventDefault()
    const name = skillInput.trim().replace(/,$/, '')
    if (!name) return
    setSkillNames(prev =>
      prev.some(s => s.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name]
    )
    setSkillInput('')
  }

  function addAuthor() {
    setAuthors(prev => [...prev, { author_name: '', author_order: prev.length + 1, is_corresponding: false }])
  }

  function updateAuthor(i: number, key: keyof Author, value: string | boolean | number) {
    setAuthors(prev => prev.map((a, idx) => idx === i ? { ...a, [key]: value } : a))
  }

  function removeAuthor(i: number) {
    setAuthors(prev => prev.filter((_, idx) => idx !== i).map((a, idx) => ({ ...a, author_order: idx + 1 })))
  }

  function onMediaFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setMediaFiles(prev => [...prev, ...files.filter(f => f.size <= 50 * 1024 * 1024)])
  }

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        title: title.trim(),
        abstract: abstract || undefined,
        journal_name: venueType === 'journal' ? journalName || undefined : undefined,
        conference_name: venueType === 'conference' ? conferenceName || undefined : undefined,
        doi: doi || undefined,
        paper_url: paperUrl || undefined,
        scholar_url: scholarUrl || undefined,
        publish_month: publishMonth ? parseInt(publishMonth) : undefined,
        publish_year: publishYear ? parseInt(publishYear) : undefined,
        skill_names: skillNames,
        authors: authors.filter(a => a.author_name.trim()),
      }

      let savedPaper
      if (paper) {
        savedPaper = await updatePaper(token, paper.paper_id, payload)
      } else {
        savedPaper = await createPaper(token, payload)
      }

      await Promise.all(mediaFiles.map(f => uploadPaperMedia(token, savedPaper.paper_id, f)))
      onSuccess()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save. Make sure the backend server is running.')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6 shadow-xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-text-muted transition hover:text-primary">
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
            <FileText className="h-5 w-5 text-purple-700" />
          </span>
          <h2 className="font-display text-xl font-bold text-text-primary">{paper ? 'Edit Research Paper' : 'Add Research Paper'}</h2>
        </div>

        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Abstract</label>
            <textarea value={abstract} onChange={e => setAbstract(e.target.value)} rows={4} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none" />
          </div>

          {/* Authors */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Authors</label>
            <div className="space-y-2">
              {authors.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-border bg-background p-2">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{a.author_order}</span>
                  <input
                    type="text"
                    value={a.author_name}
                    onChange={e => updateAuthor(i, 'author_name', e.target.value)}
                    placeholder="Author name"
                    className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                  />
                  <label className="flex cursor-pointer items-center gap-1 text-xs text-text-muted">
                    <input type="checkbox" checked={a.is_corresponding} onChange={e => updateAuthor(i, 'is_corresponding', e.target.checked)} className="accent-primary" />
                    Corresponding
                  </label>
                  {authors.length > 1 && (
                    <button onClick={() => removeAuthor(i)} className="text-text-muted transition hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addAuthor} className="mt-2 flex items-center gap-1 text-sm font-medium text-primary transition hover:opacity-70">
              <Plus className="h-4 w-4" /> Add another author
            </button>
          </div>

          {/* Venue */}
          <div>
            <div className="mb-2 flex gap-2">
              {(['journal', 'conference'] as const).map(v => (
                <button key={v} onClick={() => setVenueType(v)} className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${venueType === v ? 'bg-cta text-cta-text' : 'border border-border bg-card text-text-muted hover:border-primary hover:text-primary'}`}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            {venueType === 'journal' ? (
              <input type="text" value={journalName} onChange={e => setJournalName(e.target.value)} placeholder="Journal name" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none" />
            ) : (
              <input type="text" value={conferenceName} onChange={e => setConferenceName(e.target.value)} placeholder="Conference name" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">DOI</label>
              <input type="text" value={doi} onChange={e => setDoi(e.target.value)} placeholder="10.xxxx/xxxxx" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">Paper URL</label>
              <input type="url" value={paperUrl} onChange={e => setPaperUrl(e.target.value)} placeholder="https://…" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Google Scholar URL</label>
            <input type="url" value={scholarUrl} onChange={e => setScholarUrl(e.target.value)} placeholder="https://scholar.google.com/…" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Publication Date</label>
            <div className="grid grid-cols-2 gap-2">
              <select value={publishMonth} onChange={e => setPublishMonth(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none">
                <option value="">Month</option>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select value={publishYear} onChange={e => setPublishYear(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none">
                <option value="">Year</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Keywords/Skills */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Keywords / Skills</label>
            <p className="mb-2 text-xs text-text-muted">Type a keyword and press Enter to add</p>
            <input
              type="text"
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={handleSkillKeyDown}
              placeholder="e.g. Machine Learning, NLP — press Enter"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
            {skillNames.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {skillNames.map(name => (
                  <span key={name} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {name}
                    <button onClick={() => setSkillNames(prev => prev.filter(n => n !== name))} className="ml-1 hover:text-primary/60"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Media */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Media</label>
            <div onClick={() => fileInputRef.current?.click()} className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 transition hover:border-primary">
              <Upload className="mb-2 h-6 w-6 text-text-muted" />
              <p className="text-sm text-text-muted">Click to upload</p>
              <p className="mt-1 text-xs text-text-muted">Any format · Max 50 MB</p>
            </div>
            <input ref={fileInputRef} type="file" multiple className="sr-only" onChange={onMediaFilesChange} />
            {mediaFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {mediaFiles.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-xs text-text-muted">
                    <span className="truncate">{f.name}</span>
                    <button onClick={() => setMediaFiles(prev => prev.filter((_, j) => j !== i))} className="ml-2 flex-shrink-0 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-text-muted transition hover:border-primary hover:text-primary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="rounded-xl bg-cta px-6 py-2 text-sm font-semibold text-cta-text transition hover:opacity-90 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
