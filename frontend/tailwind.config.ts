import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        card: 'var(--color-card)',
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        highlight: 'var(--color-highlight)',
        muted: 'var(--color-muted)',
        cta: 'var(--color-cta)',
        'cta-text': 'var(--color-cta-text)',
        border: 'var(--color-border)',
        // legacy aliases kept so existing classes keep working
        surface: 'var(--color-card)',
        'text-primary': 'var(--color-primary)',
        'text-muted': 'var(--color-muted)',
        'border-subtle': 'var(--color-border)',
        notification: '#F43F5E',
        success: 'var(--color-highlight)',
        'primary-light': 'var(--color-accent-tint)',
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '1rem',
      },
      transitionDuration: {
        theme: '400ms',
      },
    },
  },
  plugins: [],
}

export default config
