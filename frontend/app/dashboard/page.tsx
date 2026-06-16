import { redirect } from 'next/navigation'
import {
  BookOpen,
  Calendar,
  ExternalLink,
  Folder,
  GraduationCap,
  Megaphone,
  MessageCircle,
  Newspaper,
  Trophy,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from './sign-out-button'
import DashboardShell from './components/DashboardShell'
import ModuleCard from './components/ModuleCard'
import StreakWidget from './components/StreakWidget'
import {
  achievements,
  articles,
  chatMessages,
  classModule,
  projects,
  streak,
  upcomingClasses,
} from './mock-data'

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const [{ data: profile }, { data: { session } }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.auth.getSession(),
  ])

  const firstName = profile?.first_name || user.email?.split('@')[0] || 'Student'
  const lastName = profile?.last_name || ''
  const initials = `${firstName.charAt(0)}${lastName.charAt(0) || ''}`.toUpperCase()

  // Fetch 2 latest real notices
  let recentNotices: Array<{ id: string; title: string; created_at: string }> = []
  if (session?.access_token) {
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
      const res = await fetch(`${BASE}/api/notices?page=1&limit=2`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        recentNotices = data.notices ?? []
      }
    } catch {}
  }

  return (
    <DashboardShell
      firstName={firstName}
      email={user.email ?? ''}
      initials={initials}
      avatarUrl={profile?.avatar_url}
      signOutButton={<SignOutButton />}
      activeItem="dashboard"
    >
      <div className="space-y-6">
        {/* Row 1 */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <ModuleCard
            title="Notices"
            icon={Megaphone}
            iconBgClassName="bg-primary-light"
            viewAllHref="/dashboard/notice-board"
          >
            {recentNotices.length > 0 ? (
              <ul className="space-y-2">
                {recentNotices.map((notice) => (
                  <li key={notice.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-text-primary">{notice.title}</span>
                    <span className="whitespace-nowrap text-xs text-text-muted">
                      {formatRelativeTime(notice.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">No notices yet.</p>
            )}
          </ModuleCard>

          <ModuleCard
            title="Chatroom"
            icon={MessageCircle}
            iconBgClassName="bg-highlight/10"
            iconClassName="text-highlight"
            viewAllHref="#"
            viewAllLabel="Open chat"
          >
            <ul className="space-y-3">
              {chatMessages.map((msg) => (
                <li key={msg.id} className="flex items-start gap-3 text-sm">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary">
                    {msg.initials}
                  </span>
                  <div>
                    <p className="text-text-primary">
                      <span className="font-medium">{msg.name}:</span> {msg.message}
                    </p>
                    <p className="text-xs text-text-muted">{msg.timestamp}</p>
                  </div>
                </li>
              ))}
            </ul>
          </ModuleCard>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <ModuleCard title="Projects" icon={Folder} iconBgClassName="bg-primary-light" viewAllHref="#">
            <ul className="space-y-3">
              {projects.map((project) => (
                <li key={project.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-text-primary">{project.name}</span>
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-text-muted">
                      {project.tag}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-accent/10">
                    <div
                      className="h-full rounded-full bg-highlight transition-all duration-500"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </ModuleCard>

          <ModuleCard
            title="Achievements"
            icon={Trophy}
            iconBgClassName="bg-accent/10"
            iconClassName="text-accent"
            viewAllHref="#"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {achievements.map((badge) => (
                <div key={badge.id} className="flex flex-col items-center gap-2 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                    <Trophy className="h-5 w-5 text-accent" />
                  </span>
                  <span className="text-xs font-medium text-text-muted">{badge.label}</span>
                </div>
              ))}
            </div>
          </ModuleCard>
        </div>

        {/* Banner */}
        <a
          href={classModule.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-[var(--shadow-card)] transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
              <GraduationCap className="h-5 w-5 text-primary" />
            </span>
            <p className="text-sm font-medium text-text-primary">
              On {classModule.teacher} Module — {classModule.className}
            </p>
          </div>
          <span className="flex items-center gap-1 self-start rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-cta-text transition hover:opacity-90 sm:self-auto">
            Open in Google Classroom
            <ExternalLink className="h-4 w-4" />
          </span>
        </a>

        {/* Row 3 */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            title="Information & Tech"
            icon={Newspaper}
            iconBgClassName="bg-primary-light"
            viewAllHref="#"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Daily Updates</p>
            <ul className="space-y-2">
              {articles.map((article) => (
                <li key={article.id} className="text-sm">
                  <p className="text-text-primary">{article.title}</p>
                  <p className="text-xs text-text-muted">
                    {article.source} · {article.timestamp}
                  </p>
                </li>
              ))}
            </ul>
          </ModuleCard>

          <ModuleCard
            title="Classes & Materials"
            icon={BookOpen}
            iconBgClassName="bg-highlight/10"
            iconClassName="text-highlight"
            viewAllHref="#"
          >
            <ul className="space-y-2">
              {upcomingClasses.map((item) => (
                <li key={item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-text-primary">{item.name}</p>
                    <p className="text-xs text-text-muted">{item.location}</p>
                  </div>
                  <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-primary-light px-2 py-1 text-xs font-medium text-primary">
                    <Calendar className="h-3 w-3" />
                    {item.time}
                  </span>
                </li>
              ))}
            </ul>
          </ModuleCard>

          <StreakWidget
            days={streak.days}
            weeklyGoalLabel={streak.weeklyGoalLabel}
            weeklyProgress={streak.weeklyProgress}
          />
        </div>
      </div>
    </DashboardShell>
  )
}
