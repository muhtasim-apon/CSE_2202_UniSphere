'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AuthShell from '../components/auth/AuthShell'

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20'

const labelClass = 'mb-1 block text-sm font-medium text-text-primary'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (signInError) {
      setError('Invalid email or password')
      return
    }

    window.location.href = '/dashboard'
  }

  return (
    <AuthShell>
        <h1 className="font-display text-2xl font-bold text-text-primary">Welcome back</h1>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label className={labelClass}>Email</label>
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className={labelClass}>Password</label>
              <Link href="/forgot-password" className="mb-1 text-xs font-semibold text-accent hover:text-highlight">
                Forgot password?
              </Link>
            </div>
            <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error && (
            <p className="rounded-lg bg-notification/10 px-3 py-2 text-sm text-notification">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-cta px-4 py-2.5 text-sm font-semibold text-cta-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-semibold text-accent hover:text-highlight">
            Sign up
          </Link>
        </p>
    </AuthShell>
  )
}
