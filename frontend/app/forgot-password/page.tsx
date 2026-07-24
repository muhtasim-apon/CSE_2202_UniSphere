'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20'

const labelClass = 'mb-1 block text-sm font-medium text-text-primary'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)
    setSubmitted(true)
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm rounded-card border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <h1 className="font-display text-2xl font-bold text-text-primary">Reset your password</h1>
        <p className="mt-1 text-sm text-text-muted">
          Enter the email associated with your account and we&apos;ll send you a link to reset your password.
        </p>

        {submitted ? (
          <div className="mt-6 rounded-lg bg-accent/10 px-4 py-3 text-sm text-text-primary">
            If an account exists for <span className="font-semibold">{email}</span>, a password reset
            link has been sent. Please check your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div>
              <label className={labelClass}>Email</label>
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-lg bg-cta px-4 py-2.5 text-sm font-semibold text-cta-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Sending link...' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-text-muted">
          Remembered your password?{' '}
          <Link href="/signin" className="font-semibold text-accent hover:text-highlight">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
