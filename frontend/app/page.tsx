import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm rounded-card border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <h1 className="font-display text-2xl font-bold text-text-primary">University Portal</h1>
        <p className="mt-2 text-sm text-text-muted">Sign in to your account or create a new one.</p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/signin"
            className="rounded-lg bg-cta px-4 py-2.5 text-sm font-semibold text-cta-text transition hover:opacity-90"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-accent/5"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  )
}
