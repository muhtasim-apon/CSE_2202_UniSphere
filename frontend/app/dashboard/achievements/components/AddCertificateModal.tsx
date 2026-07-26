'use client'

import { useState, useRef } from 'react'
import { X, Award, Upload } from 'lucide-react'
import { createCertificate, updateCertificate, uploadCertificateMedia, deleteCertificateMedia, type Certificate, type MediaItem } from '@/app/lib/achievementsApi'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1999 }, (_, i) => CURRENT_YEAR - i)

type Props = {
  token: string
  onClose: () => void
  onSuccess: () => void
  certificate?: Certificate
}

export default function AddCertificateModal({ token, onClose, onSuccess, certificate }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [certName, setCertName] = useState(certificate?.cert_name || '')
  const [issuingOrg, setIssuingOrg] = useState(certificate?.issuing_org || '')
  const [issueMonth, setIssueMonth] = useState(certificate?.issue_month ? String(certificate.issue_month) : '')
  const [issueYear, setIssueYear] = useState(certificate?.issue_year ? String(certificate.issue_year) : '')
  const [expiryMonth, setExpiryMonth] = useState(certificate?.expiry_month ? String(certificate.expiry_month) : '')
  const [expiryYear, setExpiryYear] = useState(certificate?.expiry_year ? String(certificate.expiry_year) : '')
  const [noExpiry, setNoExpiry] = useState(certificate ? !certificate.expiry_year : false)
  const [credentialId, setCredentialId] = useState(certificate?.credential_id || '')
  const [credentialUrl, setCredentialUrl] = useState(certificate?.credential_url || '')
  const [skillNames, setSkillNames] = useState<string[]>(certificate?.skills?.map(s => s.skill_name) || [])
  const [skillInput, setSkillInput] = useState('')
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [existingMedia, setExistingMedia] = useState<MediaItem[]>(certificate?.media || [])
  const [deletedMediaIds, setDeletedMediaIds] = useState<number[]>([])
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

  function isImageFile(f: File): boolean {
    return f.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(f.name)
  }

  function onMediaFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const nonImages = files.filter(f => !isImageFile(f))
    if (nonImages.length > 0) {
      setError('Certificate files must be images only.')
      return
    }
    const oversized = files.filter(f => f.size > 50 * 1024 * 1024)
    if (oversized.length > 0) {
      setError('Certificate file size must be under 50 MB.')
      return
    }

    const incomingImages = files.filter(isImageFile)
    if (incomingImages.length > 0) {
      const extImg = existingMedia.find(m => m.file_type === 'image')
      if (extImg) {
        setDeletedMediaIds(prev => [...prev, extImg.media_id])
        setExistingMedia(prev => prev.filter(item => item.media_id !== extImg.media_id))
      }
      const newImg = mediaFiles.find(isImageFile)
      if (newImg) {
        setMediaFiles(prev => prev.filter(f => f !== newImg))
      }
    }

    setMediaFiles(prev => [...prev, ...files])
    setError('')
  }

  async function handleSave() {
    if (!certName.trim()) { setError('Certificate name is required'); return }
    if (!issuingOrg.trim()) { setError('Issuing organization is required'); return }
    if (!issueYear) { setError('Issue year is required'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        cert_name: certName.trim(),
        issuing_org: issuingOrg.trim(),
        issue_month: issueMonth ? parseInt(issueMonth) : undefined,
        issue_year: parseInt(issueYear),
        expiry_month: noExpiry ? undefined : (expiryMonth ? parseInt(expiryMonth) : undefined),
        expiry_year: noExpiry ? undefined : (expiryYear ? parseInt(expiryYear) : undefined),
        credential_id: credentialId || undefined,
        credential_url: credentialUrl || undefined,
        skill_names: skillNames,
      }

      let savedCert
      if (certificate) {
        savedCert = await updateCertificate(token, certificate.certificate_id, payload)
      } else {
        savedCert = await createCertificate(token, payload)
      }

      console.log("DEBUG handleSave certificate edit:", {
        certificateId: certificate?.certificate_id,
        deletedMediaIds,
        mediaFilesToUpload: mediaFiles.map(f => f.name)
      })

      if (certificate && deletedMediaIds.length > 0) {
        await Promise.all(
          deletedMediaIds.map(mediaId =>
            deleteCertificateMedia(token, certificate.certificate_id, mediaId)
              .then(() => console.log("Successfully deleted media ID:", mediaId))
              .catch((err) => console.error("Failed to delete certificate media:", mediaId, err))
          )
        )
      }

      await Promise.all(mediaFiles.map(f => uploadCertificateMedia(token, savedCert.certificate_id, f)))
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
          <h2 className="font-display text-xl font-bold text-text-primary">{certificate ? 'Edit Certificate' : 'Add Certificate'}</h2>
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

          {/* Certificate Image */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Certificate Image</label>

            {existingMedia.some(m => m.file_type === 'image') || mediaFiles.some(isImageFile) ? (
              (() => {
                const extImg = existingMedia.find(m => m.file_type === 'image')
                const newImg = mediaFiles.find(isImageFile)
                const imgUrl = extImg ? extImg.file_url : (newImg ? URL.createObjectURL(newImg) : null)

                return (
                  <div className="relative rounded-xl border border-border bg-background p-4 flex items-center gap-4">
                    {/* Thumbnail Preview on the Left */}
                    <div className="relative h-16 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-black border border-border flex items-center justify-center">
                      {imgUrl ? (
                        <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Upload className="h-5 w-5 text-text-muted" />
                      )}
                    </div>

                    {/* Image Details in the Middle */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {extImg?.file_name || newImg?.name}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {extImg ? 'Existing Certificate' : 'Selected for Upload'}
                      </p>
                    </div>

                    {/* Delete Button on the Right */}
                    <button
                      onClick={() => {
                        if (extImg) {
                          setDeletedMediaIds(prev => [...prev, extImg.media_id])
                          setExistingMedia(prev => prev.filter(item => item.media_id !== extImg.media_id))
                        } else if (newImg) {
                          setMediaFiles(prev => prev.filter(f => f !== newImg))
                        }
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-red-50 text-text-muted hover:text-red-500 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )
              })()
            ) : (
              <>
                <div onClick={() => fileInputRef.current?.click()} className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 transition hover:border-primary">
                  <Upload className="mb-2 h-6 w-6 text-text-muted" />
                  <p className="text-sm text-text-muted">Click to upload certificate image</p>
                  <p className="mt-1 text-xs text-text-muted">Images only (PNG, JPG, WebP) · Max 50 MB (Limit 1)</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={onMediaFilesChange} />
              </>
            )}

            {/* Other attachments (excluding the certificate image since it's shown above) */}
            {mediaFiles.filter(f => !isImageFile(f)).length > 0 && (
              <ul className="mt-2 space-y-1">
                {mediaFiles.filter(f => !isImageFile(f)).map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-xs text-text-muted">
                    <span className="truncate">{f.name}</span>
                    <button onClick={() => setMediaFiles(prev => prev.filter(item => item !== f))} className="ml-2 flex-shrink-0 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}

            {existingMedia.filter(m => m.file_type !== 'image').length > 0 && (
              <div className="mt-2">
                <span className="mb-1 block text-[10px] font-semibold text-text-muted uppercase tracking-wider">Other Existing Attachments</span>
                <ul className="space-y-1.5">
                  {existingMedia.filter(m => m.file_type !== 'image').map((m) => (
                    <li key={m.media_id} className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-xs text-text-muted border border-border/40">
                      <span className="truncate font-medium">{m.file_name || 'Attachment'}</span>
                      <div className="ml-2 flex items-center gap-2 flex-shrink-0">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary text-[10px] font-semibold uppercase">{m.file_type}</span>
                        <button
                          onClick={() => {
                            setDeletedMediaIds(prev => [...prev, m.media_id])
                            setExistingMedia(prev => prev.filter(item => item.media_id !== m.media_id))
                          }}
                          className="text-text-muted hover:text-red-500 transition"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
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
