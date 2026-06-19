import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '../components/DashboardShell'
import SignOutButton from '../sign-out-button'
import ClassesClient from './ClassesClient'

export default async function ClassesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, first_name, last_name, avatar_url')
    .eq('id', user.id)
    .single()

  const firstName = profile?.first_name || user.email?.split('@')[0] || 'User'
  const lastName = profile?.last_name || ''
  const initials = `${firstName.charAt(0)}${lastName.charAt(0) || ''}`.toUpperCase()
  const role = profile?.role === 'teacher' ? 'teacher' : 'student'

  return (
    <DashboardShell
      firstName={firstName}
      email={user.email ?? ''}
      initials={initials}
      avatarUrl={profile?.avatar_url}
      signOutButton={<SignOutButton />}
      activeItem="classes"
    >
      <ClassesClient userId={user.id} role={role} />
    </DashboardShell>
  )
}
