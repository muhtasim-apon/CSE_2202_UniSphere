'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme-provider'
import { useRipple } from './Ripple'

export default function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const { theme, toggleTheme } = useTheme()
  const { onPointerDown, rippleElements } = useRipple()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      onPointerDown={onPointerDown}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`ripple-container relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-accent/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
        ${collapsed ? 'md:justify-center' : ''}
      `}
    >
      {isDark ? <Sun className="h-5 w-5 flex-shrink-0" /> : <Moon className="h-5 w-5 flex-shrink-0" />}
      <span className={collapsed ? 'md:hidden' : ''}>{isDark ? 'Light mode' : 'Dark mode'}</span>
      {rippleElements}
    </button>
  )
}
