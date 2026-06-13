'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { validateName, validateEmail, validatePhone, validatePassword } from '@/lib/validation'

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100'

const labelClass = 'mb-1 block text-sm font-medium text-slate-700'

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
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl shadow-slate-200">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
            ✓
          </div>
          <h1 className="text-xl font-bold text-slate-900">Check your email</h1>
          <p className="mt-2 text-sm text-slate-500">
            We&apos;ve sent a confirmation link to <span className="font-medium text-slate-700">{email}</span>.
            Please confirm your email before signing in.
          </p>
          <Link href="/signin" className="mt-6 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Go to sign in
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Create an account</h1>
        <p className="mt-1 text-sm text-slate-500">Sign up to access the university portal.</p>

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
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
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
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/signin" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
