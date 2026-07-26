export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '../components/DashboardShell'
import SignOutButton from '../sign-out-button'
import InfoTechClient from './InfoTechClient'
import type { Article } from './types'
import { fetchArxiv, fetchDevTo, fetchHackerNews, fetchIeee, fetchJmlr } from './fetchers'

export default async function InfoTechPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const firstName = profile?.first_name || user.email?.split('@')[0] || 'Student'
  const lastName = profile?.last_name || ''
  const initials = `${firstName.charAt(0)}${lastName.charAt(0) || ''}`.toUpperCase()

  const results = await Promise.allSettled([
    fetchArxiv(),
    fetchDevTo(),
    fetchHackerNews(),
    fetchIeee(),
    fetchJmlr(),
  ])

  const allArticles = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
  const seen = new Set<string>()
  const deduped = allArticles.filter(a => {
    if (!a.url || !a.title) return false
    if (seen.has(a.url)) return false
    seen.add(a.url)
    return true
  })

  deduped.sort((a, b) => {
    const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
    const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
    return db - da
  })

  return (
    <DashboardShell
      firstName={firstName}
      email={user.email ?? ''}
      initials={initials}
      avatarUrl={profile?.avatar_url}
      signOutButton={<SignOutButton />}
      activeItem="info-tech"
    >
      <InfoTechClient articles={deduped} />
    </DashboardShell>
  )
}
