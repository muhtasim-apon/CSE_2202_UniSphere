'use client'

import { useState, useRef } from 'react'
import { X, Trophy, Upload } from 'lucide-react'
import { createHackathon, uploadHackathonMedia, skillNamesToIds } from '@/app/lib/achievementsApi'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1999 }, (_, i) => CURRENT_YEAR - i)

type Props = {
  token: string
  onClose: () => void
  onSuccess: () => void
}

export default function AddHackathonModal({ token, onClose, onSuccess }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [organizer, setOrganizer] = useState('')
  const [position, setPosition] = useState('')
  const [teamName, setTeamName] = useState('')
  const [startMonth, setStartMonth] = useState('')
  const [startYear, setStartYear] = useState('')
  const [endMonth, setEndMonth] = useState('')
  const [endYear, setEndYear] = useState('')
  const [description, setDescription] = useState('')
  const [prize, setPrize] = useState('')
  const [eventUrl, setEventUrl] = useState('')
  const [skillNames, setSkillNames] = useState<string[]>([])
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

  function onMediaFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setMediaFiles(prev => [...prev, ...files.filter(f => f.size <= 50 * 1024 * 1024)])
  }

  function toIsoDate(year: string, month: string): string | undefined {
    if (!year) return undefined
    const mm = month ? String(month).padStart(2, '0') : '01'
    return `${year}-${mm}-01`
  }

  async function handleSave() {
    if (!title.trim()) { setError('Hackathon name is required'); return }
    setSaving(true)
    setError('')
    try {
      const skillIds = await skillNamesToIds(token, skillNames)
      const hack = await createHackathon(token, {
        title: title.trim(),
        organizer: organizer.trim() || undefined,
        position: position.trim() || undefined,
        team_name: teamName.trim() || undefined,
        start_date: toIsoDate(startYear, startMonth),
        end_date: toIsoDate(endYear, endMonth),
        description: description.trim() || undefined,
        prize: prize.trim() || undefined,
        event_url: eventUrl.trim() || undefined,
        skill_ids: skillIds,
      })
      await Promise.all(mediaFiles.map(f => uploadHackathonMedia(token, hack.hackathon_id, f)))
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
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
            <Trophy className="h-5 w-5 text-orange-600" />
          </span>
          <h2 className="font-display text-xl font-bold text-text-primary">Add Hackathon</h2>
        </div>

        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Hackathon Name *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. HackCSE 2024, BUET CSE Fest Hackathon"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">Organizer</label>
              <input
                type="text"
                value={organizer}
                onChange={e => setOrganizer(e.target.value)}
                placeholder="e.g. BUET ACM, IEEE DU"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">Position / Award</label>
              <input
                type="text"
                value={position}
                onChange={e => setPosition(e.target.value)}
                placeholder="e.g. Champion, Runner-up, Finalist"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">Team Name</label>
              <input
                type="text"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="e.g. CodeCrafters"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">Prize / Reward</label>
              <input
                type="text"
                value={prize}
                onChange={e => setPrize(e.target.value)}
                placeholder="e.g. ৳50,000 cash prize"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
              />
            </div>
          </div>

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
                <select value={endMonth} onChange={e => setEndMonth(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none">
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select value={endYear} onChange={e => setEndYear(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none">
                  <option value="">Year</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the problem you solved, your approach, and what you built…"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Event URL</label>
            <input
              type="url"
              value={eventUrl}
              onChange={e => setEventUrl(e.target.value)}
              placeholder="https://devpost.com/…"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Skills Used</label>
            <p className="mb-2 text-xs text-text-muted">Type a skill and press Enter to add</p>
            <input
              type="text"
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={handleSkillKeyDown}
              placeholder="e.g. React, FastAPI, PostgreSQL"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
            {skillNames.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {skillNames.map(name => (
                  <span key={name} className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                    {name}
                    <button onClick={() => setSkillNames(prev => prev.filter(n => n !== name))} className="ml-1 hover:text-orange-400"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Media</label>
            <div onClick={() => fileInputRef.current?.click()} className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 transition hover:border-primary">
              <Upload className="mb-2 h-6 w-6 text-text-muted" />
              <p className="text-sm text-text-muted">Click to upload screenshots, slides, etc.</p>
              <p className="mt-1 text-xs text-text-muted">Any format · Max 50 MB per file</p>
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
          <button onClick={handleSave} disabled={saving} className="rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
