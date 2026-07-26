'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
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
    const path = `${userId}/avatar_${Date.now()}.${ext}`

    // Delete the old photo if it exists to clean up storage
    if (photoUrl) {
      try {
        const parts = photoUrl.split('/profile-photos/')
        if (parts.length > 1) {
          const oldPath = decodeURIComponent(parts[1])
          await supabase.storage.from('profile-photos').remove([oldPath])
        }
      } catch (err) {
        console.error('Failed to remove old photo:', err)
      }
    }

    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setUploading(false)
      setError(uploadError.message)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('profile-photos').getPublicUrl(path)
    const newPhotoUrl = publicUrlData.publicUrl

    // Update the row through the backend (service_role) so RLS on
    // the student / instructor table doesn't reject the write.
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setUploading(false)
      setError('Your session has expired. Please sign in again.')
      return
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL
    const response = await fetch(`${apiBase}/api/profile/photo`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ photo_url: newPhotoUrl, role }),
    })

    setUploading(false)

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setError(body?.detail ?? `Failed to save profile photo (HTTP ${response.status})`)
      return
    }

    setCacheBust((n) => n + 1)
    onUploaded(newPhotoUrl)
    router.refresh()
  }

  const displayUrl = photoUrl ? `${photoUrl}?v=${cacheBust}` : null

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full bg-accent/10">
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
          className="cursor-pointer rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent/20"
        >
          {uploading ? 'Uploading...' : 'Change photo'}
        </label>
        <p className="mt-1 text-xs text-text-muted">JPEG, PNG or WEBP, up to 2MB</p>
        {error && <p className="mt-1 text-xs text-notification">{error}</p>}
      </div>
    </div>
  )
}
