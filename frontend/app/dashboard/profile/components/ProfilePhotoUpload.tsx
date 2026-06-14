'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 2 * 1024 * 1024

type ProfilePhotoUploadProps = {
  userId: string
  role: 'student' | 'instructor'
  photoUrl: string | null
  initials: string
  onUploaded: (url: string) => void
}

export default function ProfilePhotoUpload({ userId, role, photoUrl, initials, onUploaded }: ProfilePhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cacheBust, setCacheBust] = useState(0)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, or WEBP images are allowed')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('Image must be 2MB or smaller')
      return
    }

    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setUploading(false)
      setError(uploadError.message)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('profile-photos').getPublicUrl(path)

    const table = role === 'instructor' ? 'instructor' : 'student'
    const { error: updateError } = await supabase
      .from(table)
      .update({ profile_photo: publicUrlData.publicUrl })
      .eq('profile_id', userId)

    setUploading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setCacheBust((n) => n + 1)
    onUploaded(publicUrlData.publicUrl)
  }

  const displayUrl = photoUrl ? `${photoUrl}?v=${cacheBust}` : null

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full bg-primary-light">
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayUrl} alt="Profile photo" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-primary">
            {initials}
          </span>
        )}
      </div>

      <div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
          id="profile-photo-input"
        />
        <label
          htmlFor="profile-photo-input"
          className="cursor-pointer rounded-lg bg-primary-light px-3 py-2 text-sm font-medium text-primary transition hover:opacity-90"
        >
          {uploading ? 'Uploading...' : 'Change photo'}
        </label>
        <p className="mt-1 text-xs text-text-muted">JPEG, PNG or WEBP, up to 2MB</p>
        {error && <p className="mt-1 text-xs text-notification">{error}</p>}
      </div>
    </div>
  )
}
