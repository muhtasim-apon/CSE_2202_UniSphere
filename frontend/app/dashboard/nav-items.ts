export type NavGroup = 'home' | 'academics' | 'community' | 'portfolio' | 'account'

export type NavItem = {
  id: string
  label: string
  href: string
  group: NavGroup
}

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', group: 'home' },
  { id: 'classes', label: 'Classes', href: '/dashboard/classes', group: 'academics' },
  { id: 'notices', label: 'Notices', href: '/dashboard/notice-board', group: 'community' },
  { id: 'chatroom', label: 'Chatroom', href: '/dashboard/chatroom', group: 'community' },
  { id: 'info-tech', label: 'Info & Tech', href: '/dashboard/info-tech', group: 'community' },
  { id: 'projects', label: 'Projects', href: '/dashboard/projects', group: 'portfolio' },
  { id: 'achievements', label: 'Achievements', href: '/dashboard/achievements', group: 'portfolio' },
  { id: 'profile', label: 'Profile', href: '/dashboard/profile', group: 'account' },
]
