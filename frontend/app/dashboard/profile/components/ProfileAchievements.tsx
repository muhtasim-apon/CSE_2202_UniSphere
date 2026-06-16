'use client'

import { useState, useEffect } from 'react'
import { Folder, Award, FileText, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getProjects, getCertificates, getPapers, type Project, type Certificate, type ResearchPaper } from '@/app/lib/achievementsApi'
import AchievementCard, { type AchievementCardData } from '../../achievements/components/AchievementCard'
import AddProjectModal from '../../achievements/components/AddProjectModal'
import AddCertificateModal from '../../achievements/components/AddCertificateModal'
import AddResearchPaperModal from '../../achievements/components/AddResearchPaperModal'

type CompactItem = {
  id: number
  type: 'project' | 'certificate' | 'research_paper'
  title: string
  subtitle?: string | null
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
  project: 'Project', certificate: 'Certificate', research_paper: 'Research Paper',
}
const TYPE_ICON: Record<string, typeof Folder> = {
  project: Folder, certificate: Award, research_paper: FileText,
}

type Props = {
  userId: string
}

export default function ProfileAchievements({ userId }: Props) {
  const [token, setToken] = useState('')
  const [items, setItems] = useState<CompactItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<AchievementCardData | null>(null)
  const [editModal, setEditModal] = useState<'project' | 'certificate' | 'paper' | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      setToken(session.access_token)
      setIsOwner(session.user.id === userId)

      const profile = await supabase.from('profiles').select('first_name, last_name').eq('id', session.user.id).single()
      setUserName(`${profile.data?.first_name ?? ''} ${profile.data?.last_name ?? ''}`.trim())

      try {
        const [pr, cr, pa] = await Promise.all([
          getProjects(session.access_token),
          getCertificates(session.access_token),
          getPapers(session.access_token),
        ])

        const all: CompactItem[] = [
          ...pr.projects.map((p: Project) => ({
            id: p.project_id, type: 'project' as const, title: p.title,
            subtitle: p.associated_with, thumbnailUrl: p.thumbnail_url, date: p.created_at,
            cardData: { id: p.project_id, type: 'project' as const, title: p.title, subtitle: p.associated_with, description: p.description, thumbnailUrl: p.thumbnail_url, githubUrl: p.github_url, liveDemoUrl: p.live_demo_url, skills: p.skills, reactions: p.reactions, avgRating: p.avg_rating, commentCount: p.comment_count, authorName: p.author_name, media: p.media, relativeDate: new Date(p.created_at).toLocaleDateString(), userId: p.user_id } as AchievementCardData,
          })),
          ...cr.certificates.map((c: Certificate) => ({
            id: c.certificate_id, type: 'certificate' as const, title: c.cert_name,
            subtitle: c.issuing_org, date: c.created_at,
            cardData: { id: c.certificate_id, type: 'certificate' as const, title: c.cert_name, subtitle: c.issuing_org, skills: c.skills, reactions: c.reactions, avgRating: c.avg_rating, commentCount: c.comment_count, authorName: c.author_name, media: c.media, relativeDate: new Date(c.created_at).toLocaleDateString(), userId: c.user_id } as AchievementCardData,
          })),
          ...pa.papers.map((p: ResearchPaper) => ({
            id: p.paper_id, type: 'research_paper' as const, title: p.title,
            subtitle: p.journal_name || p.conference_name, date: p.created_at,
            cardData: { id: p.paper_id, type: 'research_paper' as const, title: p.title, subtitle: p.journal_name || p.conference_name, description: p.abstract, scholarUrl: p.scholar_url, skills: p.keywords, reactions: p.reactions, avgRating: p.avg_rating, commentCount: p.comment_count, authorName: p.author_name, media: p.media, relativeDate: new Date(p.created_at).toLocaleDateString(), userId: p.user_id } as AchievementCardData,
          })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        setItems(all)
      } catch {}
      setLoading(false)
    })
  }, [userId])

  if (loading) return (
    <div className="mt-8">
      <h2 className="mb-4 font-display text-xl font-bold text-text-primary">Achievements</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => <div key={i} className="h-32 animate-pulse rounded-card border border-border bg-border" />)}
      </div>
    </div>
  )

  return (
    <div className="mt-8">
      <h2 className="mb-4 font-display text-xl font-bold text-text-primary">Achievements</h2>

      {items.length === 0 ? (
        <p className="text-sm text-text-muted">No public achievements yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(item => {
            const Icon = TYPE_ICON[item.type]
            return (
              <div
                key={`${item.type}-${item.id}`}
                className="relative cursor-pointer rounded-card border border-border bg-card p-4 shadow-[var(--shadow-card)] transition hover:shadow-md"
                onClick={() => setSelectedCard(item.cardData)}
              >
                {isOwner && (
                  <button
                    onClick={e => { e.stopPropagation(); setEditModal(item.type === 'research_paper' ? 'paper' : item.type) }}
                    className="absolute right-3 top-3 rounded-lg border border-border bg-card p-1.5 text-text-muted transition hover:border-primary hover:text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                <div className="mb-3 flex items-center gap-3">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light">
                      <Icon className="h-6 w-6 text-primary" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{item.title}</p>
                    {item.subtitle && <p className="truncate text-xs text-text-muted">{item.subtitle}</p>}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_BADGE[item.type]}`}>
                  {TYPE_LABEL[item.type]}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Full card modal */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4" onClick={() => setSelectedCard(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <AchievementCard data={selectedCard} token={token} />
          </div>
        </div>
      )}

      {/* Edit modals */}
      {editModal === 'project' && token && (
        <AddProjectModal token={token} onClose={() => setEditModal(null)} onSuccess={() => setEditModal(null)} />
      )}
      {editModal === 'certificate' && token && (
        <AddCertificateModal token={token} onClose={() => setEditModal(null)} onSuccess={() => setEditModal(null)} />
      )}
      {editModal === 'paper' && token && (
        <AddResearchPaperModal token={token} currentUserName={userName} onClose={() => setEditModal(null)} onSuccess={() => setEditModal(null)} />
      )}
    </div>
  )
}
