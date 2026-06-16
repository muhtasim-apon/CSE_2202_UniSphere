'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Folder, Award, FileText, Plus, ChevronRight, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getProjects, getCertificates, type Project, type Certificate } from '@/app/lib/achievementsApi'
import AchievementCard, { type AchievementCardData } from '../achievements/components/AchievementCard'
import AddProjectModal from '../achievements/components/AddProjectModal'
import AddCertificateModal from '../achievements/components/AddCertificateModal'
import AddResearchPaperModal from '../achievements/components/AddResearchPaperModal'

type RecentItem = {
  id: number
  type: 'project' | 'certificate' | 'research_paper'
  title: string
  thumbnailUrl?: string | null
  date: string
  cardData: AchievementCardData
}

const TYPE_BADGE: Record<string, string> = {
  project: 'bg-blue-50 text-blue-700',
  certificate: 'bg-green-50 text-green-700',
  research_paper: 'bg-purple-50 text-purple-700',
}
const TYPE_LABEL: Record<string, string> = {
  project: 'Project',
  certificate: 'Certificate',
  research_paper: 'Paper',
}

function relDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function ProjectsModuleCard() {
  const [token, setToken] = useState('')
  const [userName, setUserName] = useState('')
  const [recent, setRecent] = useState<RecentItem[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [addModal, setAddModal] = useState<'project' | 'certificate' | 'paper' | null>(null)
  const [selectedCard, setSelectedCard] = useState<AchievementCardData | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      setToken(session.access_token)

      const profile = await supabase.from('profiles').select('first_name, last_name').eq('id', session.user.id).single()
      const fn = profile.data?.first_name ?? ''
      const ln = profile.data?.last_name ?? ''
      setUserName(`${fn} ${ln}`.trim())

      try {
        const [pr, cr] = await Promise.all([
          getProjects(session.access_token, undefined, 1),
          getCertificates(session.access_token, undefined, 1),
        ])
        const items: RecentItem[] = [
          ...pr.projects.map((p: Project) => ({
            id: p.project_id,
            type: 'project' as const,
            title: p.title,
            thumbnailUrl: p.thumbnail_url,
            date: p.created_at,
            cardData: {
              id: p.project_id,
              type: 'project' as const,
              title: p.title,
              subtitle: p.associated_with,
              description: p.description,
              thumbnailUrl: p.thumbnail_url,
              githubUrl: p.github_url,
              liveDemoUrl: p.live_demo_url,
              skills: p.skills,
              reactions: p.reactions,
              avgRating: p.avg_rating,
              commentCount: p.comment_count,
              authorName: p.author_name,
              media: p.media,
              relativeDate: new Date(p.created_at).toLocaleDateString(),
              userId: p.user_id,
            } as AchievementCardData,
          })),
          ...cr.certificates.map((c: Certificate) => ({
            id: c.certificate_id,
            type: 'certificate' as const,
            title: c.cert_name,
            date: c.created_at,
            cardData: {
              id: c.certificate_id,
              type: 'certificate' as const,
              title: c.cert_name,
              subtitle: c.issuing_org,
              skills: c.skills,
              reactions: c.reactions,
              avgRating: c.avg_rating,
              commentCount: c.comment_count,
              authorName: c.author_name,
              media: c.media,
              relativeDate: new Date(c.created_at).toLocaleDateString(),
              userId: c.user_id,
            } as AchievementCardData,
          })),
        ]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 3)
        setRecent(items)
      } catch {}
    })
  }, [])

  function handleAddSuccess() {
    if (!token) return
    Promise.all([getProjects(token, undefined, 1), getCertificates(token, undefined, 1)]).then(([pr, cr]) => {
      const items: RecentItem[] = [
        ...pr.projects.map((p: Project) => ({
          id: p.project_id, type: 'project' as const, title: p.title, thumbnailUrl: p.thumbnail_url, date: p.created_at,
          cardData: { id: p.project_id, type: 'project' as const, title: p.title, subtitle: p.associated_with, description: p.description, thumbnailUrl: p.thumbnail_url, githubUrl: p.github_url, liveDemoUrl: p.live_demo_url, skills: p.skills, reactions: p.reactions, avgRating: p.avg_rating, commentCount: p.comment_count, authorName: p.author_name, media: p.media, relativeDate: new Date(p.created_at).toLocaleDateString(), userId: p.user_id } as AchievementCardData,
        })),
        ...cr.certificates.map((c: Certificate) => ({
          id: c.certificate_id, type: 'certificate' as const, title: c.cert_name, date: c.created_at,
          cardData: { id: c.certificate_id, type: 'certificate' as const, title: c.cert_name, subtitle: c.issuing_org, skills: c.skills, reactions: c.reactions, avgRating: c.avg_rating, commentCount: c.comment_count, authorName: c.author_name, media: c.media, relativeDate: new Date(c.created_at).toLocaleDateString(), userId: c.user_id } as AchievementCardData,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3)
      setRecent(items)
    }).catch(() => {})
  }

  return (
    <>
      <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)] transition hover:shadow-md">
        {/* Icon banner */}
        <div className="mb-4 flex h-24 items-center justify-center rounded-xl bg-primary-light md:h-28">
          <Folder className="h-8 w-8 text-primary" />
        </div>

        {/* Title row */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-text-primary">Projects</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(d => !d)}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-border bg-card shadow-lg">
                  <button onClick={() => { setAddModal('project'); setDropdownOpen(false) }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-primary transition hover:bg-primary/5 hover:text-primary">
                    <Folder className="h-4 w-4" /> Add Project
                  </button>
                  <button onClick={() => { setAddModal('certificate'); setDropdownOpen(false) }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-primary transition hover:bg-primary/5 hover:text-primary">
                    <Award className="h-4 w-4" /> Add Certificate
                  </button>
                  <button onClick={() => { setAddModal('paper'); setDropdownOpen(false) }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-primary transition hover:bg-primary/5 hover:text-primary">
                    <FileText className="h-4 w-4" /> Add Research Paper
                  </button>
                </div>
              )}
            </div>
            <Link href="/dashboard/achievements" className="flex items-center gap-1 text-sm font-medium text-primary transition hover:underline">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Recent items — clickable */}
        {recent.length > 0 ? (
          <ul className="mb-4 space-y-3">
            {recent.map(item => (
              <li
                key={`${item.type}-${item.id}`}
                className="flex cursor-pointer items-center gap-3 rounded-xl p-1.5 transition hover:bg-primary/5"
                onClick={() => setSelectedCard(item.cardData)}
              >
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-light text-lg font-bold text-primary">
                    {item.title.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{item.title}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_BADGE[item.type]}`}>
                      {TYPE_LABEL[item.type]}
                    </span>
                    <span className="text-xs text-text-muted">{relDate(item.date)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-text-muted">No achievements yet.</p>
        )}

        {/* Bottom pills */}
        <div className="flex gap-2">
          <Link href="/dashboard/achievements?tab=projects" className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-text-muted transition hover:border-primary hover:text-primary">
            My Projects
          </Link>
          <Link href="/dashboard/achievements?tab=certificates" className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-text-muted transition hover:border-primary hover:text-primary">
            My Certificates
          </Link>
        </div>
      </div>

      {/* Detail modal */}
      {selectedCard && token && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setSelectedCard(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedCard(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-card p-1.5 text-text-muted shadow transition hover:text-primary"
            >
              <X className="h-4 w-4" />
            </button>
            <AchievementCard data={selectedCard} token={token} />
          </div>
        </div>
      )}

      {addModal === 'project' && token && (
        <AddProjectModal token={token} onClose={() => setAddModal(null)} onSuccess={handleAddSuccess} />
      )}
      {addModal === 'certificate' && token && (
        <AddCertificateModal token={token} onClose={() => setAddModal(null)} onSuccess={handleAddSuccess} />
      )}
      {addModal === 'paper' && token && (
        <AddResearchPaperModal token={token} currentUserName={userName} onClose={() => setAddModal(null)} onSuccess={handleAddSuccess} />
      )}
    </>
  )
}
