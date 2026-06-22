import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '../sign-out-button'
import DashboardShell from '../components/DashboardShell'
import ChatroomClient from './ChatroomClient'

export default async function ChatroomPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, avatar_url, role')
    .eq('id', user.id)
    .single()

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
      activeItem="chatroom"
      userRole={profile?.role}
      fullHeight
    >
      <ChatroomClient userId={user.id} displayName={`${firstName} ${lastName}`.trim() || null} avatarUrl={profile?.avatar_url ?? null} />
    </DashboardShell>
  )
}
