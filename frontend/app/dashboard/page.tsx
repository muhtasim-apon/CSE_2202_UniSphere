import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from './sign-out-button'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/signin')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Demonstrate Next.js -> FastAPI -> Supabase call
  let apiResult: unknown = null
  let apiError: string | null = null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/me`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (res.ok) {
      apiResult = await res.json()
    } else {
      apiError = `API returned ${res.status}`
    }
  } catch {
    apiError = 'Could not reach FastAPI backend'
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-xl shadow-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">{user.email}</p>
          </div>
          <SignOutButton />
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Profile (Supabase)
            </h2>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
              {JSON.stringify(profile, null, 2)}
            </pre>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Profile (FastAPI /api/me)
            </h2>
            {apiError ? (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{apiError}</p>
            ) : (
              <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                {JSON.stringify(apiResult, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
