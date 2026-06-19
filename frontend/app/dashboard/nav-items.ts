export type NavItem = {
  id: string
  label: string
  href: string
}

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { id: 'notices', label: 'Notices', href: '/dashboard/notice-board' },
  { id: 'chatroom', label: 'Chatroom', href: '/dashboard/chatroom' },
  { id: 'projects', label: 'Projects', href: '/dashboard/projects' },
  { id: 'info-tech', label: 'Info & Tech', href: '/dashboard/info-tech' },
  { id: 'classes', label: 'Classes', href: '/dashboard/classes' },
  { id: 'profile', label: 'Profile', href: '/dashboard/profile' },
]
