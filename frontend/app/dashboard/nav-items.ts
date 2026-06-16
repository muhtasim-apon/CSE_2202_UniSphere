export type NavItem = {
  id: string
  label: string
  href: string
}

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { id: 'notices', label: 'Notices', href: '/dashboard/notice-board' },
  { id: 'chatroom', label: 'Chatroom', href: '#' },
  { id: 'projects', label: 'Projects', href: '#' },
  { id: 'classes', label: 'Classes', href: '#' },
  { id: 'achievements', label: 'Achievements', href: '#' },
  { id: 'profile', label: 'Profile', href: '/dashboard/profile' },
  { id: 'settings', label: 'Settings', href: '#' },
]
