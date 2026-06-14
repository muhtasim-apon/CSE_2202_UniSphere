'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, GraduationCap, Menu, Settings, User } from 'lucide-react'
import type { ReactNode } from 'react'

type HeaderProps = {
  firstName: string
  email: string
  initials: string
  avatarUrl?: string | null
  unreadNotifications: number
  onMenuClick: () => void
  signOutButton: ReactNode
}

export default function Header({
  firstName,
  email,
  initials,
  avatarUrl,
  unreadNotifications,
  onMenuClick,
  signOutButton,
}: HeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <header className="flex items-center justify-between border-b border-border-subtle bg-surface px-4 py-3 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Toggle sidebar"
          className="rounded-lg p-2 text-text-muted transition hover:bg-slate-50 hover:text-text-primary"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-text-muted transition hover:bg-slate-50 hover:text-text-primary"
        >
          <Bell className="h-5 w-5" />
          {unreadNotifications > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-notification text-[10px] font-bold text-white">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
        </button>

        <p className="hidden text-sm text-text-muted sm:block">
          Welcome back, <span className="font-semibold text-text-primary">{firstName}</span>
        </p>
      </div>

      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
        <GraduationCap className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold text-primary">EduHub</span>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setProfileOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-white transition hover:opacity-90"
          aria-label="Open profile menu"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={firstName} className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </button>

        {profileOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} aria-hidden="true" />
            <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-border-subtle bg-surface p-2 shadow-md">
              <div className="border-b border-border-subtle px-3 py-2">
                <p className="text-sm font-semibold text-text-primary">{firstName}</p>
                <p className="truncate text-xs text-text-muted">{email}</p>
              </div>

              <Link
                href="/dashboard/profile"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary transition hover:bg-slate-50"
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
              <a
                href="#"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary transition hover:bg-slate-50"
              >
                <Settings className="h-4 w-4" />
                Settings
              </a>

              <div className="mt-1 border-t border-border-subtle pt-2">{signOutButton}</div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
