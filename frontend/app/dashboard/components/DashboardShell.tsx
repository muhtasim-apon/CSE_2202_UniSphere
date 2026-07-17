'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import PageTransition from '../../components/PageTransition'
import NotificationRealtimeListener from './NotificationRealtimeListener'

type DashboardShellProps = {
  firstName: string
  email: string
  initials: string
  avatarUrl?: string | null
  signOutButton: ReactNode
  activeItem?: string
  userRole?: string
  fullHeight?: boolean
  children: ReactNode
}

export default function DashboardShell({
  firstName,
  email,
  initials,
  avatarUrl,
  signOutButton,
  activeItem = 'dashboard',
  userRole,
  fullHeight,
  children,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  function toggleSidebar() {
    setCollapsed((c) => !c)
    setMobileOpen((o) => !o)
  }

  return (
    <div className={`flex bg-background ${fullHeight ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <NotificationRealtimeListener />
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        activeItem={activeItem}
      />

      <div className={`flex flex-1 flex-col min-w-0 ${fullHeight ? 'h-full' : 'min-h-screen'}`}>
        <Header
          firstName={firstName}
          email={email}
          initials={initials}
          avatarUrl={avatarUrl}
          onMenuClick={toggleSidebar}
          signOutButton={signOutButton}
          userRole={userRole}
        />

        <main className={fullHeight ? 'flex-1 overflow-hidden flex flex-col min-h-0 p-4 md:p-6' : 'flex-1 overflow-y-auto p-4 md:p-8'}>
          {fullHeight ? children : <PageTransition>{children}</PageTransition>}
        </main>
      </div>
    </div>
  )
}
