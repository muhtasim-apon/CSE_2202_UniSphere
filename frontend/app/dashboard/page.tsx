import { redirect } from 'next/navigation'
import {
  BookOpen,
  Megaphone,
  MessageCircle,
  Newspaper,
  Trophy,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from './sign-out-button'
import DashboardShell from './components/DashboardShell'
import ModuleCard from './components/ModuleCard'
import ProjectsModuleCard from './components/ProjectsModuleCard'
import { fetchArxiv, fetchDevTo, fetchHackerNews, fetchIeee, fetchJmlr } from './info-tech/page'

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

type Notice = { id: string; title: string; created_at: string }
type ChatRoom = {
  id: string
  title: string | null
  type: string
  last_message?: { body: string | null; created_at: string } | null
}
type ManualCourse = { manual_course_id: number; course_name: string; course_code: string | null }
type Article = { id: string; title: string; description: string; url: string; source: string; publishedAt: string; authors?: string[] }
type AchievementItem = { id: number; title: string; type: 'project' | 'certificate' | 'research_paper'; created_at: string }

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

  let recentNotices: Notice[] = []
  let recentRooms: ChatRoom[] = []
  let recentCourses: ManualCourse[] = []
  let recentArticles: Article[] = []
  let recentAchievements: AchievementItem[] = []

  if (session?.access_token) {
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
    const auth = { Authorization: `Bearer ${session.access_token}` }

    const [noticesRes, roomsRes, coursesRes, projectsRes, certsRes, papersRes, arxivFeed, devToFeed, hnFeed, ieeeFeed, jmlrFeed] =
      await Promise.allSettled([
        fetch(`${BASE}/api/notices?page=1&limit=2`, { headers: auth, cache: 'no-store' }),
        fetch(`${BASE}/api/chat/rooms`, { headers: auth, cache: 'no-store' }),
        fetch(`${BASE}/api/classes/manual`, { headers: auth, cache: 'no-store' }),
        fetch(`${BASE}/api/achievements/projects?page=1&limit=3`, { headers: auth, cache: 'no-store' }),
        fetch(`${BASE}/api/achievements/certificates?page=1&limit=3`, { headers: auth, cache: 'no-store' }),
        fetch(`${BASE}/api/achievements/papers?page=1&limit=3`, { headers: auth, cache: 'no-store' }),
        fetchArxiv(),
        fetchDevTo(),
        fetchHackerNews(),
        fetchIeee(),
        fetchJmlr(),
      ])

    if (noticesRes.status === 'fulfilled' && noticesRes.value.ok) {
      const data = await noticesRes.value.json()
      recentNotices = data.notices ?? []
    }

    if (roomsRes.status === 'fulfilled' && roomsRes.value.ok) {
      const rooms: ChatRoom[] = await roomsRes.value.json()
      recentRooms = rooms
        .filter(r => r.last_message)
        .sort((a, b) => new Date(b.last_message!.created_at).getTime() - new Date(a.last_message!.created_at).getTime())
        .slice(0, 2)
    }

    if (coursesRes.status === 'fulfilled' && coursesRes.value.ok) {
      const data = await coursesRes.value.json()
      recentCourses = (data.courses ?? []).slice(0, 2)
    }

    const allFeeds = [
      ...(arxivFeed.status === 'fulfilled' ? arxivFeed.value : []),
      ...(devToFeed.status === 'fulfilled' ? devToFeed.value : []),
      ...(hnFeed.status === 'fulfilled' ? hnFeed.value : []),
      ...(ieeeFeed.status === 'fulfilled' ? ieeeFeed.value : []),
      ...(jmlrFeed.status === 'fulfilled' ? jmlrFeed.value : []),
    ]

    const seen = new Set<string>()
    const deduped = allFeeds.filter(a => {
      if (!a.url || !a.title) return false
      if (seen.has(a.url)) return false
      seen.add(a.url)
      return true
    })

    deduped.sort((a, b) => {
      const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
      const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      return db - da
    })

    recentArticles = deduped.slice(0, 3)

    const achievementItems: AchievementItem[] = []
    if (projectsRes.status === 'fulfilled' && projectsRes.value.ok) {
      const data = await projectsRes.value.json()
      for (const p of data.projects ?? []) {
        achievementItems.push({ id: p.project_id, title: p.title, type: 'project', created_at: p.created_at })
      }
    }
    if (certsRes.status === 'fulfilled' && certsRes.value.ok) {
      const data = await certsRes.value.json()
      for (const c of data.certificates ?? []) {
        achievementItems.push({ id: c.certificate_id, title: c.cert_name, type: 'certificate', created_at: c.created_at })
      }
    }
    if (papersRes.status === 'fulfilled' && papersRes.value.ok) {
      const data = await papersRes.value.json()
      for (const p of data.papers ?? []) {
        achievementItems.push({ id: p.paper_id, title: p.title, type: 'research_paper', created_at: p.created_at })
      }
    }
    recentAchievements = achievementItems
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 2)
  }

  const ACHIEVEMENT_LABEL: Record<AchievementItem['type'], string> = {
    project: 'Project',
    certificate: 'Certificate',
    research_paper: 'Paper',
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
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Welcome back, {firstName}</h1>
            <p className="mt-1 text-sm text-text-muted">Here&apos;s your latest activity across UniSphere</p>
          </div>
          <p className="text-sm text-text-muted">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
            iconBgClassName="bg-primary-light"
            viewAllHref="/dashboard/chatroom"
            viewAllLabel="Open chat"
          >
            {recentRooms.length > 0 ? (
              <ul className="space-y-3">
                {recentRooms.map((room) => (
                  <li key={room.id} className="flex items-start gap-3 text-sm">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary">
                      {(room.title || 'DM').charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-text-primary">
                        <span className="font-medium">{room.title || 'Direct message'}:</span>{' '}
                        {room.last_message?.body || 'Sent an attachment'}
                      </p>
                      <p className="text-xs text-text-muted">
                        {room.last_message ? formatRelativeTime(room.last_message.created_at) : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">No conversations yet.</p>
            )}
          </ModuleCard>

          <ModuleCard
            title="Classes & Materials"
            icon={BookOpen}
            iconBgClassName="bg-primary-light"
            viewAllHref="/dashboard/classes"
          >
            {recentCourses.length > 0 ? (
              <ul className="space-y-2">
                {recentCourses.map((course) => (
                  <li key={course.manual_course_id} className="flex items-center justify-between text-sm">
                    <p className="font-medium text-text-primary">{course.course_name}</p>
                    {course.course_code && (
                      <span className="whitespace-nowrap rounded-full bg-primary-light px-2 py-1 text-xs font-medium text-primary">
                        {course.course_code}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">No courses yet.</p>
            )}
          </ModuleCard>

          <ModuleCard
            title="Information & Tech"
            icon={Newspaper}
            iconBgClassName="bg-primary-light"
            viewAllHref="/dashboard/info-tech"
          >
            {recentArticles.length > 0 ? (
              <ul className="space-y-2">
                {recentArticles.map((article) => (
                  <li key={article.id} className="text-sm">
                    <p className="text-text-primary">{article.title}</p>
                    <p className="text-xs text-text-muted">
                      {article.source}
                      {article.authors && article.authors.length > 0 && ` · By ${article.authors.slice(0, 2).join(', ')}`}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">No articles right now.</p>
            )}
          </ModuleCard>

          <ProjectsModuleCard />

          <ModuleCard
            title="Achievements"
            icon={Trophy}
            iconBgClassName="bg-primary-light"
            viewAllHref="/dashboard/achievements"
          >
            {recentAchievements.length > 0 ? (
              <ul className="space-y-2">
                {recentAchievements.map((item) => (
                  <li key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-text-primary">{item.title}</span>
                    <span className="whitespace-nowrap rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary">
                      {ACHIEVEMENT_LABEL[item.type]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">No achievements yet.</p>
            )}
          </ModuleCard>
        </div>
      </div>
    </DashboardShell>
  )
}
