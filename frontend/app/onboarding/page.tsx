import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthShell from '../components/auth/AuthShell'
import OnboardingForm from './components/OnboardingForm'

export default async function OnboardingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/signin')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, student_id, instructor_id')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'student' && profile.student_id) {
    redirect('/dashboard')
  }
  if (profile?.role === 'teacher' && profile.instructor_id) {
    redirect('/dashboard')
  }
  if (profile?.role !== 'student' && profile?.role !== 'teacher') {
    redirect('/dashboard')
  }

  const role = profile.role === 'teacher' ? 'instructor' : 'student'

  return (
    <AuthShell cardMaxWidth="max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-text-primary">Complete your profile</h1>
      <p className="mt-1 text-sm text-text-muted">
        {role === 'instructor'
          ? "We need a few more details to set up your instructor record before you can access the dashboard."
          : "We need a few more details to set up your student record before you can access the dashboard."}
      </p>

      <OnboardingForm role={role} />
    </AuthShell>
  )
}
