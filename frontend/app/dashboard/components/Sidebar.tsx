'use client'

import Link from 'next/link'
import {
  BookOpen,
  Folder,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Newspaper,
  Settings,
  Trophy,
  User,
  type LucideIcon,
} from 'lucide-react'
import { navItems } from '../nav-items'
import ThemeToggle from '../../components/ThemeToggle'

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  notices: Megaphone,
  chatroom: MessageCircle,
  projects: Folder,
  'info-tech': Newspaper,
  classes: BookOpen,
  achievements: Trophy,
  profile: User,
  settings: Settings,
}

type SidebarProps = {
  collapsed: boolean
  mobileOpen: boolean
  onCloseMobile: () => void
  activeItem?: string
}

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile, activeItem = 'dashboard' }: SidebarProps) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card transition-all duration-theme md:static md:translate-x-0
          ${collapsed ? 'md:w-16' : 'md:w-60'}
          ${mobileOpen ? 'w-60 translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = ICONS[item.id]
              const isActive = item.id === activeItem
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    title={item.label}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition
                      ${isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-accent/5 hover:text-primary'}
                      ${collapsed ? 'md:justify-center' : ''}
                    `}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className={`${collapsed ? 'md:hidden' : ''}`}>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-border px-2 py-3">
          <ThemeToggle collapsed={collapsed} />
        </div>
      </aside>
    </>
  )
}
