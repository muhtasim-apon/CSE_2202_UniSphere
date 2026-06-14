import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-xl shadow-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Complete your profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          {role === 'instructor'
            ? "We need a few more details to set up your instructor record before you can access the dashboard."
            : "We need a few more details to set up your student record before you can access the dashboard."}
        </p>

        <OnboardingForm role={role} />
      </div>
    </main>
  )
}
