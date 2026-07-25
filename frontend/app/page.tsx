import Link from 'next/link'
import AuthShell from './components/auth/AuthShell'

export default function Home() {
  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-bold text-text-primary text-center">
        One Connected Campus
      </h1>
      <div className="mt-6 flex flex-col gap-3">
        <Link
          href="/signin"
          className="rounded-lg bg-cta px-4 py-2.5 text-sm font-semibold text-cta-text text-center transition hover:opacity-90"
        >
          Sign In
        </Link>
        <Link
          href="/signup"
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary text-center transition hover:bg-accent/5"
        >
          Sign Up
        </Link>
      </div>
    </AuthShell>
  )
}
