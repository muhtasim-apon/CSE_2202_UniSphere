'use client'

import { useState, useRef } from 'react'
import { X, Award, Upload } from 'lucide-react'
import { createCertificate, uploadCertificateMedia } from '@/app/lib/achievementsApi'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1999 }, (_, i) => CURRENT_YEAR - i)

type Props = {
  token: string
  onClose: () => void
  onSuccess: () => void
}

export default function AddCertificateModal({ token, onClose, onSuccess }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [certName, setCertName] = useState('')
  const [issuingOrg, setIssuingOrg] = useState('')
  const [issueMonth, setIssueMonth] = useState('')
  const [issueYear, setIssueYear] = useState('')
  const [expiryMonth, setExpiryMonth] = useState('')
  const [expiryYear, setExpiryYear] = useState('')
  const [noExpiry, setNoExpiry] = useState(false)
  const [credentialId, setCredentialId] = useState('')
  const [credentialUrl, setCredentialUrl] = useState('')
  const [skillNames, setSkillNames] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Purely local — no API call while typing
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

  async function handleSave() {
    if (!certName.trim()) { setError('Certificate name is required'); return }
    if (!issuingOrg.trim()) { setError('Issuing organization is required'); return }
    if (!issueYear) { setError('Issue year is required'); return }
    setSaving(true)
    setError('')
    try {
      const cert = await createCertificate(token, {
        cert_name: certName.trim(),
        issuing_org: issuingOrg.trim(),
        issue_month: issueMonth ? parseInt(issueMonth) : undefined,
        issue_year: parseInt(issueYear),
        expiry_month: noExpiry ? undefined : (expiryMonth ? parseInt(expiryMonth) : undefined),
        expiry_year: noExpiry ? undefined : (expiryYear ? parseInt(expiryYear) : undefined),
        credential_id: credentialId || undefined,
        credential_url: credentialUrl || undefined,
        skill_names: skillNames,
      })
      await Promise.all(mediaFiles.map(f => uploadCertificateMedia(token, cert.certificate_id, f)))
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
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
            <Award className="h-5 w-5 text-green-700" />
          </span>
          <h2 className="font-display text-xl font-bold text-text-primary">Add Certificate</h2>
        </div>

        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Name *</label>
            <input type="text" value={certName} onChange={e => setCertName(e.target.value)} placeholder="Ex: Microsoft Certified Network Associate Security" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Issuing Organization *</label>
            <input type="text" value={issuingOrg} onChange={e => setIssuingOrg(e.target.value)} placeholder="Ex: Microsoft" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">Issue Date *</label>
              <div className="grid grid-cols-2 gap-2">
                <select value={issueMonth} onChange={e => setIssueMonth(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none">
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select value={issueYear} onChange={e => setIssueYear(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none">
                  <option value="">Year *</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">Expiration Date</label>
              <div className="grid grid-cols-2 gap-2">
                <select value={expiryMonth} onChange={e => setExpiryMonth(e.target.value)} disabled={noExpiry} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none disabled:opacity-50">
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select value={expiryYear} onChange={e => setExpiryYear(e.target.value)} disabled={noExpiry} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none disabled:opacity-50">
                  <option value="">Year</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <label className="mt-2 flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={noExpiry} onChange={e => setNoExpiry(e.target.checked)} className="accent-primary" />
                <span className="text-xs text-text-muted">This credential does not expire</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">Credential ID</label>
              <input type="text" value={credentialId} onChange={e => setCredentialId(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">Credential URL</label>
              <input type="url" value={credentialUrl} onChange={e => setCredentialUrl(e.target.value)} placeholder="https://…" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none" />
            </div>
          </div>

          {/* Skills — local chips, saved to DB only when Save is clicked */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Skills</label>
            <p className="mb-2 text-xs text-text-muted">Type a skill and press Enter to add</p>
            <input
              type="text"
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={handleSkillKeyDown}
              placeholder="e.g. Cloud, Networking, AI — press Enter"
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
            <p className="mb-2 text-xs text-text-muted">Add images, documents, or any other files.</p>
            <div onClick={() => fileInputRef.current?.click()} className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 transition hover:border-primary">
              <Upload className="mb-2 h-6 w-6 text-text-muted" />
              <p className="text-sm text-text-muted">Click to upload files</p>
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
