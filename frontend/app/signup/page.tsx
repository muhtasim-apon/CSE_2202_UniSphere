'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { validateName, validateEmail, validatePhone, validatePassword } from '@/lib/validation'
import AuthShell from '../components/auth/AuthShell'

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20'

const labelClass = 'mb-1 block text-sm font-medium text-text-primary'

export default function SignUpPage() {
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const errors = [
      validateName(firstName) && `First name: ${validateName(firstName)}`,
      validateName(lastName) && `Last name: ${validateName(lastName)}`,
      validateEmail(email) && `Email: ${validateEmail(email)}`,
      validatePhone(phone) && `Phone: ${validatePhone(phone)}`,
      validatePassword(password) && `Password: ${validatePassword(password)}`,
      password !== confirmPassword && 'Passwords do not match',
    ].filter(Boolean)

    if (errors.length > 0) {
      setError(errors.join(', '))
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          first_name: firstName,
          last_name: lastName,
          ...(phone ? { phone } : {}),
        },
      },
    })

    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-highlight/15 text-highlight">
            ✓
          </div>
          <h1 className="font-display text-xl font-bold text-text-primary">Check your email</h1>
          <p className="mt-2 text-sm text-text-muted">
            We&apos;ve sent a confirmation link to <span className="font-medium text-text-primary">{email}</span>.
            Please confirm your email before signing in.
          </p>
          <Link href="/signin" className="mt-6 inline-block text-sm font-semibold text-accent hover:text-highlight">
            Go to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
        <h1 className="font-display text-2xl font-bold text-text-primary">Create an account</h1>
        <p className="mt-1 text-sm text-text-muted">Sign up to access the university portal.</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label className={labelClass}>Join as</label>
            <div className="grid grid-cols-2 gap-3">
              {(['student', 'teacher'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRole(option)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                    role === option
                      ? 'border-accent bg-accent/30 text-white'
                      : 'border-border text-muted hover:bg-accent/5'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>First Name</label>
              <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>Last Name</label>
              <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div>
            <label className={labelClass}>Phone (optional)</label>
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
          </div>

          <div>
            <label className={labelClass}>Password</label>
            <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <div>
            <label className={labelClass}>Confirm Password</label>
            <input className={inputClass} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>

          {error && (
            <p className="rounded-lg bg-notification/10 px-3 py-2 text-sm text-notification">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-cta px-4 py-2.5 text-sm font-semibold text-cta-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-muted">
          Already have an account?{' '}
          <Link href="/signin" className="font-semibold text-accent hover:text-highlight">
            Sign in
          </Link>
        </p>
    </AuthShell>
  )
}
