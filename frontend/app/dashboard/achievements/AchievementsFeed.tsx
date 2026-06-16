'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Folder, Award, FileText } from 'lucide-react'
import {
  getProjects, getCertificates, getPapers,
  type Project, type Certificate, type ResearchPaper,
} from '@/app/lib/achievementsApi'
import AchievementCard, { type AchievementCardData } from './components/AchievementCard'
import AddProjectModal from './components/AddProjectModal'
import AddCertificateModal from './components/AddCertificateModal'
import AddResearchPaperModal from './components/AddResearchPaperModal'

type Tab = 'all' | 'projects' | 'certificates' | 'papers'

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'projects', label: 'Projects' },
  { key: 'certificates', label: 'Certificates' },
  { key: 'papers', label: 'Research Papers' },
]

function projectToCard(p: Project): AchievementCardData {
  const dateRange = [
    p.start_year ? `${p.start_year}` : null,
    p.is_current ? 'Present' : (p.end_year ? `${p.end_year}` : null),
  ].filter(Boolean).join(' – ')
  return {
    id: p.project_id,
    type: 'project',
    title: p.title,
    subtitle: p.associated_with,
    description: p.description,
    thumbnailUrl: p.thumbnail_url,
    githubUrl: p.github_url,
    liveDemoUrl: p.live_demo_url,
    dateRange: dateRange || null,
    skills: p.skills,
    reactions: p.reactions,
    avgRating: p.avg_rating,
    commentCount: p.comment_count,
    authorName: p.author_name,
    media: p.media,
    relativeDate: p.created_at ? new Date(p.created_at).toLocaleDateString() : '',
    userId: p.user_id,
  }
}

function certToCard(c: Certificate): AchievementCardData {
  const dateRange = [
    c.issue_year ? `${c.issue_year}` : null,
    c.expiry_year ? `${c.expiry_year}` : 'No Expiry',
  ].filter(Boolean).join(' – ')
  return {
    id: c.certificate_id,
    type: 'certificate',
    title: c.cert_name,
    subtitle: c.issuing_org,
    dateRange,
    skills: c.skills,
    reactions: c.reactions,
    avgRating: c.avg_rating,
    commentCount: c.comment_count,
    authorName: c.author_name,
    media: c.media,
    relativeDate: c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
    userId: c.user_id,
  }
}

function paperToCard(p: ResearchPaper): AchievementCardData {
  return {
    id: p.paper_id,
    type: 'research_paper',
    title: p.title,
    subtitle: p.journal_name || p.conference_name,
    description: p.abstract,
    scholarUrl: p.scholar_url,
    skills: p.keywords,
    reactions: p.reactions,
    avgRating: p.avg_rating,
    commentCount: p.comment_count,
    authorName: p.author_name,
    media: p.media,
    relativeDate: p.created_at ? new Date(p.created_at).toLocaleDateString() : '',
    userId: p.user_id,
  }
}

type Props = { token: string; currentUserName: string }

export default function AchievementsFeed({ token, currentUserName }: Props) {
  const [tab, setTab] = useState<Tab>('all')
  const [cards, setCards] = useState<AchievementCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState<'project' | 'certificate' | 'paper' | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const load = useCallback(async (t: Tab) => {
    if (!token) return
    setLoading(true)
    try {
      if (t === 'all') {
        const [pr, cr, pa] = await Promise.allSettled([
          getProjects(token),
          getCertificates(token),
          getPapers(token),
        ])
        const mixed = [
          ...(pr.status === 'fulfilled' ? pr.value.projects.map(projectToCard) : []),
          ...(cr.status === 'fulfilled' ? cr.value.certificates.map(certToCard) : []),
          ...(pa.status === 'fulfilled' ? pa.value.papers.map(paperToCard) : []),
        ].sort((a, b) => (b.relativeDate ?? '').localeCompare(a.relativeDate ?? ''))
        setCards(mixed)
      } else if (t === 'projects') {
        const { projects } = await getProjects(token)
        setCards(projects.map(projectToCard))
      } else if (t === 'certificates') {
        const { certificates } = await getCertificates(token)
        setCards(certificates.map(certToCard))
      } else {
        const { papers } = await getPapers(token)
        setCards(papers.map(paperToCard))
      }
    } catch {}
    setLoading(false)
  }, [token])

  useEffect(() => { load(tab) }, [tab, load])

  function handleAddSuccess() { load(tab) }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">Achievements</h1>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(d => !d)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-xl border border-border bg-card shadow-lg">
              <button onClick={() => { setAddModal('project'); setDropdownOpen(false) }} className="flex w-full items-center gap-3 px-4 py-3 text-sm text-text-primary transition hover:bg-primary/5 hover:text-primary">
                <Folder className="h-4 w-4" /> Add Project
              </button>
              <button onClick={() => { setAddModal('certificate'); setDropdownOpen(false) }} className="flex w-full items-center gap-3 px-4 py-3 text-sm text-text-primary transition hover:bg-primary/5 hover:text-primary">
                <Award className="h-4 w-4" /> Add Certificate
              </button>
              <button onClick={() => { setAddModal('paper'); setDropdownOpen(false) }} className="flex w-full items-center gap-3 px-4 py-3 text-sm text-text-primary transition hover:bg-primary/5 hover:text-primary">
                <FileText className="h-4 w-4" /> Add Research Paper
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === key
                ? 'bg-primary text-white'
                : 'border border-border bg-card text-text-muted hover:border-primary hover:text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-border" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-border" />
                  <div className="h-3 w-24 animate-pulse rounded bg-border" />
                </div>
              </div>
              <div className="h-6 w-48 animate-pulse rounded bg-border" />
            </div>
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-10 text-center shadow-[var(--shadow-card)]">
          <p className="text-text-muted">No achievements yet. Share your first one!</p>
          <button onClick={() => setDropdownOpen(true)} className="mt-4 mx-auto flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
            <Plus className="h-4 w-4" /> Add Achievement
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {cards.map(card => (
            <AchievementCard key={`${card.type}-${card.id}`} data={card} token={token} />
          ))}
        </div>
      )}

      {addModal === 'project' && (
        <AddProjectModal token={token} onClose={() => setAddModal(null)} onSuccess={handleAddSuccess} />
      )}
      {addModal === 'certificate' && (
        <AddCertificateModal token={token} onClose={() => setAddModal(null)} onSuccess={handleAddSuccess} />
      )}
      {addModal === 'paper' && (
        <AddResearchPaperModal token={token} currentUserName={currentUserName} onClose={() => setAddModal(null)} onSuccess={handleAddSuccess} />
      )}
    </div>
  )
}
