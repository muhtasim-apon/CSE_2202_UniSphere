import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5',
          light: '#EEF2FF',
        },
        accent: '#F59E0B',
        success: '#10B981',
        surface: '#FFFFFF',
        background: '#F8FAFC',
        'text-primary': '#0F172A',
        'text-muted': '#64748B',
        'border-subtle': '#E2E8F0',
        notification: '#F43F5E',
      },
    },
  },
  plugins: [],
}

export default config
