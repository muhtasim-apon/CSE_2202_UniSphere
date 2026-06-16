'use client'

import { useState, useCallback, useRef } from 'react'
import { X, Folder, Upload, ChevronLeft } from 'lucide-react'
import { createProject, uploadProjectMedia } from '@/app/lib/achievementsApi'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 2009 }, (_, i) => CURRENT_YEAR - i)

type Props = {
  token: string
  onClose: () => void
  onSuccess: () => void
}

export default function AddProjectModal({ token, onClose, onSuccess }: Props) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [githubUrl, setGithubUrl] = useState('')
  const [liveDemoUrl, setLiveDemoUrl] = useState('')
  const [isCurrent, setIsCurrent] = useState(false)
  const [startMonth, setStartMonth] = useState('')
  const [startYear, setStartYear] = useState('')
  const [endMonth, setEndMonth] = useState('')
  const [endYear, setEndYear] = useState('')
  const [associatedWith, setAssociatedWith] = useState('')

  // Step 2
  const [skillNames, setSkillNames] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  function onThumbnailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Thumbnail must be an image'); return }
    if (f.size > 5 * 1024 * 1024) { setError('Thumbnail must be under 5 MB'); return }
    setThumbnail(f)
    setThumbnailPreview(URL.createObjectURL(f))
    setError('')
  }

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

  function onMediaFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const oversized = files.filter(f => f.size > 50 * 1024 * 1024)
    if (oversized.length) { setError('Some files exceed 50 MB'); return }
    setMediaFiles(prev => [...prev, ...files])
    setError('')
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    setMediaFiles(prev => [...prev, ...files.filter(f => f.size <= 50 * 1024 * 1024)])
  }, [])

  async function handleSave() {
    if (!title.trim()) { setError('Project name is required'); return }
    setSaving(true)
    setError('')
    try {
      const project = await createProject(token, {
        title: title.trim(),
        description: description || undefined,
        github_url: githubUrl || undefined,
        live_demo_url: liveDemoUrl || undefined,
        start_month: startMonth ? parseInt(startMonth) : undefined,
        start_year: startYear ? parseInt(startYear) : undefined,
        end_month: isCurrent ? undefined : (endMonth ? parseInt(endMonth) : undefined),
        end_year: isCurrent ? undefined : (endYear ? parseInt(endYear) : undefined),
        is_current: isCurrent,
        associated_with: associatedWith || undefined,
        skill_names: skillNames,
      })

      await Promise.all(mediaFiles.map(f => uploadProjectMedia(token, project.project_id, f)))

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
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
            <Folder className="h-5 w-5 text-primary" />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold text-text-primary">
              {step === 1 ? 'Add Project' : 'Skills & Media'}
            </h2>
            <p className="text-xs text-text-muted">Step {step} of 2</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="mb-6 flex gap-2">
          {[1, 2].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-border'}`} />
          ))}
        </div>

        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">Project Name *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="My Awesome Project"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                Description <span className="float-right text-xs text-text-muted">{description.length}/2000</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value.slice(0, 2000))}
                rows={4}
                placeholder="Describe your project…"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
              />
              <p className="mt-1 text-xs text-text-muted">2000 maximum characters allowed</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">Thumbnail (image, max 5 MB)</label>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-4 transition hover:border-primary">
                {thumbnailPreview ? (
                  <img src={thumbnailPreview} alt="" className="max-h-32 rounded-lg object-cover" />
                ) : (
                  <>
                    <Upload className="mb-2 h-6 w-6 text-text-muted" />
                    <span className="text-sm text-text-muted">Click to upload thumbnail</span>
                  </>
                )}
                <input type="file" accept="image/*" className="sr-only" onChange={onThumbnailChange} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">GitHub URL</label>
                <input type="url" value={githubUrl} onChange={e => setGithubUrl(e.target.value)} placeholder="https://github.com/..." className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">Live Demo URL</label>
                <input type="url" value={liveDemoUrl} onChange={e => setLiveDemoUrl(e.target.value)} placeholder="https://your-project.vercel.app" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none" />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={isCurrent} onChange={e => setIsCurrent(e.target.checked)} className="h-4 w-4 rounded border-border text-primary accent-primary" />
              <span className="text-sm text-text-primary">I am currently working on this project</span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">Start Date</label>
                <div className="grid grid-cols-2 gap-2">
                  <select value={startMonth} onChange={e => setStartMonth(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none">
                    <option value="">Month</option>
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                  <select value={startYear} onChange={e => setStartYear(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none">
                    <option value="">Year</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">End Date</label>
                <div className="grid grid-cols-2 gap-2">
                  <select value={endMonth} onChange={e => setEndMonth(e.target.value)} disabled={isCurrent} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none disabled:opacity-50">
                    <option value="">Month</option>
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                  <select value={endYear} onChange={e => setEndYear(e.target.value)} disabled={isCurrent} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none disabled:opacity-50">
                    <option value="">Year</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">Associated with</label>
              <input type="text" value={associatedWith} onChange={e => setAssociatedWith(e.target.value)} placeholder="e.g. CSE 2202 – DBMS Lab Project" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none" />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Skills */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">Skills</label>
              <p className="mb-2 text-xs text-text-muted">Type a skill name and press Enter to add</p>
              <input
                type="text"
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                placeholder="e.g. React, Python — press Enter to add"
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
              <div
                onDrop={onDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 transition hover:border-primary"
              >
                <Upload className="mb-2 h-6 w-6 text-text-muted" />
                <p className="text-sm text-text-muted">Drag & drop or click to upload</p>
                <p className="mt-1 text-xs text-text-muted">Any format · Max 50 MB per file</p>
              </div>
              <input ref={fileInputRef} type="file" multiple className="sr-only" onChange={onMediaFilesChange} />
              {mediaFiles.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {mediaFiles.map((f, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-xs text-text-muted">
                      <span className="truncate">{f.name}</span>
                      <div className="ml-2 flex items-center gap-2 flex-shrink-0">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                        <button onClick={() => setMediaFiles(prev => prev.filter((_, j) => j !== i))} className="text-text-muted hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button onClick={onClose} className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-text-muted transition hover:border-primary hover:text-primary">
            Cancel
          </button>
          <div className="flex gap-2">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="flex items-center gap-1 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-text-muted transition hover:border-primary hover:text-primary">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            )}
            {step === 1 ? (
              <button onClick={() => { if (!title.trim()) { setError('Project name is required'); return } setError(''); setStep(2) }} className="rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90">
                Next
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving} className="rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
