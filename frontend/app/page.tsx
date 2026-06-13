import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl shadow-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">University Portal</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in to your account or create a new one.</p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/signin"
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  )
}
