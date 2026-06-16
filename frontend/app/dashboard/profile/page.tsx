import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '../sign-out-button'
import DashboardShell from '../components/DashboardShell'
import ProfileView from './components/ProfileView'

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/signin')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role === 'teacher' ? 'instructor' : 'student'

  const { data: profileData, error: profileError } = await supabase
    .from(role === 'instructor' ? 'v_my_instructor_profile' : 'v_my_student_profile')
    .select('*')
    .eq('profile_id', user.id)
    .maybeSingle()

  const firstName = profileData?.first_name || user.email?.split('@')[0] || 'User'
  const lastName = profileData?.last_name || ''
  const initials = `${firstName.charAt(0)}${lastName.charAt(0) || ''}`.toUpperCase()

  return (
    <DashboardShell
      firstName={firstName}
      email={user.email ?? ''}
      initials={initials}
      avatarUrl={profileData?.profile_photo}
      signOutButton={<SignOutButton />}
      activeItem="profile"
    >
      {profileData ? (
        <ProfileView userId={user.id} role={role} initialProfile={profileData} />
      ) : (
        <div className="rounded-card border border-border bg-card p-5 text-sm text-text-muted shadow-[var(--shadow-card)]">
          Could not load your profile{profileError ? `: ${profileError.message}` : '.'}
        </div>
      )}
    </DashboardShell>
  )
}
