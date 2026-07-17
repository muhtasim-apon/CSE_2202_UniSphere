'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Megaphone, Menu, Settings, User, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNotifications } from '@/app/context/NotificationContext'
import { useTheme } from '@/app/theme-provider'

type HeaderProps = {
  firstName: string
  email: string
  initials: string
  avatarUrl?: string | null
  onMenuClick: () => void
  signOutButton: ReactNode
  userRole?: string
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} min ago`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'notice') return <Megaphone className="h-4 w-4 text-primary" />
  if (type === 'profile') return <User className="h-4 w-4 text-highlight" />
  return <Bell className="h-4 w-4 text-accent" />
}

export default function Header({
  firstName,
  email,
  initials,
  avatarUrl,
  onMenuClick,
  signOutButton,
}: HeaderProps) {
  const router = useRouter()
  const { theme } = useTheme()
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const { notifications, unreadCount, markAllRead, clearAll, markRead, removeNotification } = useNotifications()

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Toggle sidebar"
          className="rounded-lg p-2 text-text-muted transition hover:bg-accent/5 hover:text-primary"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Bell + Notification Panel */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen(o => !o)}
            aria-label="Notifications"
            className="relative rounded-lg p-2 text-text-muted transition hover:bg-accent/5 hover:text-primary"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-notification text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setNotifOpen(false)}
                  aria-hidden="true"
                />
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-12 z-50 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
                >
                  {/* Panel header */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-semibold text-text-primary">Notifications</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={markAllRead}
                        className="text-xs text-primary transition hover:underline"
                      >
                        Mark all read
                      </button>
                      <button
                        onClick={clearAll}
                        className="text-xs text-red-500 transition hover:underline"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-border-subtle" />

                  {/* Notification list */}
                  <div className="max-h-[360px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-12 text-text-muted">
                        <Bell className="h-8 w-8 opacity-30" />
                        <p className="text-sm font-medium">All caught up!</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition hover:bg-accent/5 ${
                            !n.read ? 'bg-primary/5' : ''
                          }`}
                          onClick={() => {
                            markRead(n.id)
                            router.push(n.href)
                            setNotifOpen(false)
                          }}
                        >
                          {!n.read && (
                            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                          )}
                          <span className="mt-0.5 flex-shrink-0">
                            <NotifIcon type={n.type} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm font-medium text-text-primary">{n.title}</p>
                            <p className="line-clamp-2 text-xs text-text-muted">{n.body}</p>
                            <p className="mt-0.5 text-xs text-text-muted">{formatRelativeTime(n.timestamp)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              removeNotification(n.id)
                            }}
                            className="flex-shrink-0 rounded p-0.5 text-text-muted transition hover:bg-accent/10 hover:text-text-primary"
                            aria-label="Dismiss notification"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <p className="hidden text-sm text-text-muted sm:block">
          Welcome back, <span className="font-semibold text-text-primary">{firstName}</span>
        </p>
      </div>

      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
        <img
          src={theme === 'dark'
            ? 'https://mftrlabicbiixlgprdbi.supabase.co/storage/v1/object/public/logos/logo_dark.png'
            : 'https://mftrlabicbiixlgprdbi.supabase.co/storage/v1/object/public/logos/logo_light.png'}
          alt="UniVerse"
          className="h-14 w-auto"
        />
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setProfileOpen(open => !open)}
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
            <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-border bg-card p-2 shadow-md">
              <div className="border-b border-border-subtle px-3 py-2">
                <p className="text-sm font-semibold text-text-primary">{firstName}</p>
                <p className="truncate text-xs text-text-muted">{email}</p>
              </div>

              <Link
                href="/dashboard/profile"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary transition hover:bg-accent/5"
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
              <a
                href="#"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary transition hover:bg-accent/5"
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
