import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'University Auth',
  description: 'Sign Up / Sign In',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 text-slate-900">
        {children}
      </body>
    </html>
  )
}
