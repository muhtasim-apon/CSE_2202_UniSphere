'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AuthShell from '../components/auth/AuthShell'

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20'

const labelClass = 'mb-1 block text-sm font-medium text-text-primary'

export default function ResetPasswordPage() {
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function establishSession() {
      // PKCE flow: Supabase sends ?code=... which must be exchanged for a session.
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
      }

      // Implicit flow: Supabase sends #access_token=...&type=recovery in the hash,
      // which supabase-js auto-detects on client init (detectSessionInUrl).
      const { data: { session } } = await supabase.auth.getSession()
      setHasSession(!!session)
      setCheckingSession(false)
    }

    establishSession()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
    setTimeout(() => {
      window.location.href = '/signin'
    }, 1500)
  }

  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-bold text-text-primary">Set a new password</h1>
      <p className="mt-1 text-sm text-text-muted">Choose a new password for your account.</p>

      {checkingSession ? (
        <div className="mt-6 flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      ) : !hasSession ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg bg-notification/10 px-4 py-3 text-sm text-notification">
            This reset link is invalid or has expired. Please request a new one.
          </div>
          <Link
            href="/forgot-password"
            className="block w-full rounded-lg bg-cta px-4 py-2.5 text-center text-sm font-semibold text-cta-text transition hover:opacity-90"
          >
            Request a new link
          </Link>
        </div>
      ) : success ? (
        <div className="mt-6 rounded-lg bg-accent/10 px-4 py-3 text-sm text-text-primary">
          Your password has been updated. Redirecting you to sign in...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label className={labelClass}>New password</label>
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div>
            <label className={labelClass}>Confirm new password</label>
            <input
              className={inputClass}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-notification/10 px-3 py-2 text-sm text-notification">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-cta px-4 py-2.5 text-sm font-semibold text-cta-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
