import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '../sign-out-button'
import DashboardShell from '../components/DashboardShell'
import AchievementsFeed from '../achievements/AchievementsFeed'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const [{ data: profile }, { data: { session } }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.auth.getSession(),
  ])

  const firstName = profile?.first_name || user.email?.split('@')[0] || 'User'
  const lastName = profile?.last_name || ''
  const initials = `${firstName.charAt(0)}${lastName.charAt(0) || ''}`.toUpperCase()

  return (
    <DashboardShell
      firstName={firstName}
      email={user.email ?? ''}
      initials={initials}
      avatarUrl={profile?.avatar_url}
      signOutButton={<SignOutButton />}
      activeItem="projects"
    >
      <AchievementsFeed
        token={session?.access_token ?? ''}
        currentUserName={`${firstName} ${lastName}`.trim()}
        initialTab="projects"
      />
    </DashboardShell>
  )
}
