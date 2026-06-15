'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import PageTransition from '../../components/PageTransition'

type DashboardShellProps = {
  firstName: string
  email: string
  initials: string
  avatarUrl?: string | null
  unreadNotifications: number
  signOutButton: ReactNode
  activeItem?: string
  children: ReactNode
}

export default function DashboardShell({
  firstName,
  email,
  initials,
  avatarUrl,
  unreadNotifications,
  signOutButton,
  activeItem = 'dashboard',
  children,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  function toggleSidebar() {
    setCollapsed((c) => !c)
    setMobileOpen((o) => !o)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        activeItem={activeItem}
      />

      <div className="flex min-h-screen flex-1 flex-col">
        <Header
          firstName={firstName}
          email={email}
          initials={initials}
          avatarUrl={avatarUrl}
          unreadNotifications={unreadNotifications}
          onMenuClick={toggleSidebar}
          signOutButton={signOutButton}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  )
}
