'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookMarked,
  BookOpen,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Link2,
  Loader2,
  Mail,
  Phone,
  Search,
  Signal,
  Star,
  User,
  Users,
  X,
  FileText,
} from 'lucide-react'
import type {
  DesignationRank,
  FacultyDetail,
  FacultyMember,
} from './types'
import { DESIGNATION_RANK_ORDER } from './types'

// ── Constants ─────────────────────────────────────────────────

const RANK_BADGE_COLORS: Record<DesignationRank, string> = {
  Chairman:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Professor:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Associate Professor':
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  'Assistant Professor':
    'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  Lecturer:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  Other:
    'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300',
}

const RANK_AVATAR_BG: Record<DesignationRank, string> = {
  Chairman: 'bg-amber-500',
  Professor: 'bg-blue-600',
  'Associate Professor': 'bg-indigo-600',
  'Assistant Professor': 'bg-violet-600',
  Lecturer: 'bg-green-600',
  Other: 'bg-slate-500',
}

const RANKS: DesignationRank[] = [
  'Chairman',
  'Professor',
  'Associate Professor',
  'Assistant Professor',
  'Lecturer',
  'Other',
]

// ── Collapsible Section ───────────────────────────────────────

function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-text-primary hover:bg-accent/5 transition"
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-text-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-muted" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────

function Avatar({
  member,
  size = 'md',
}: {
  member: Pick<FacultyMember, 'name' | 'photoUrl' | 'designationRank'>
  size?: 'md' | 'lg'
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const dim = size === 'lg' ? 'h-32 w-32' : 'h-24 w-24'
  const text = size === 'lg' ? 'text-3xl' : 'text-2xl'
  const initials = member.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (member.photoUrl && !imgFailed) {
    return (
      <img
        src={member.photoUrl}
        alt={member.name}
        className={`${dim} rounded-full object-cover ring-2 ring-border group-hover:ring-accent transition-all duration-300`}
        loading="lazy"
        onError={() => setImgFailed(true)}
      />
    )
  }

  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center ${text} font-bold text-white ring-2 ring-border group-hover:ring-accent transition-all ${RANK_AVATAR_BG[member.designationRank]}`}
    >
      {initials}
    </div>
  )
}

// ── Faculty Card ──────────────────────────────────────────────

function FacultyCard({
  member,
  onClick,
}: {
  member: FacultyMember
  onClick: () => void
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
      }}
      onClick={onClick}
      className="cursor-pointer rounded-card border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:border-accent hover:shadow-lg group flex flex-col items-center text-center"
    >
      <Avatar member={member} />

      <span
        className={`mt-3 rounded-full px-2 py-0.5 text-[10px] font-bold ${RANK_BADGE_COLORS[member.designationRank]}`}
      >
        {member.designationRank}
      </span>

      <h3 className="mt-1.5 font-display text-sm font-bold leading-snug text-text-primary group-hover:text-accent transition-colors line-clamp-2">
        {member.name}
      </h3>
      {member.designation && (
        <p className="mt-0.5 text-xs text-text-muted line-clamp-1">
          {member.designation}
        </p>
      )}

      {(member.email || member.phone) && (
        <div className="mt-2 w-full space-y-0.5 border-t border-border pt-2">
          {member.email && (
            <p className="flex items-center gap-1 text-[10px] text-text-muted truncate">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{member.email}</span>
            </p>
          )}
          {member.phone && (
            <p className="flex items-center gap-1 text-[10px] text-text-muted">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span>{member.phone}</span>
            </p>
          )}
        </div>
      )}

      <span className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-accent">
        View Profile <ChevronRight className="h-3 w-3" />
      </span>
    </motion.div>
  )
}

// ── Chairman Featured Card ────────────────────────────────────

function ChairmanCard({
  member,
  onClick,
}: {
  member: FacultyMember
  onClick: () => void
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const initials = member.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
      }}
      onClick={onClick}
      className="cursor-pointer rounded-card border border-amber-300/60 bg-card shadow-[var(--shadow-card)] transition-all hover:border-amber-400 hover:shadow-xl group overflow-hidden"
    >
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent px-5 py-3 border-b border-amber-200/40">
        <span className="text-xs font-bold tracking-widest text-amber-700 dark:text-amber-400 uppercase">
          Chairman of the Department
        </span>
      </div>
      <div className="flex items-center gap-6 p-6">
        <div className="flex-shrink-0">
          {member.photoUrl && !imgFailed ? (
            <img
              src={member.photoUrl}
              alt={member.name}
              className="h-36 w-36 rounded-full object-cover ring-4 ring-amber-200/60 group-hover:ring-amber-400/80 transition-all duration-300"
              loading="lazy"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="h-36 w-36 rounded-full flex items-center justify-center text-4xl font-bold text-white ring-4 ring-amber-200/60 bg-amber-500">
              {initials}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-2xl font-bold text-text-primary group-hover:text-accent transition-colors">
            {member.name}
          </h3>
          {member.designation && (
            <p className="mt-1 text-sm text-text-muted">{member.designation}</p>
          )}
          <p className="mt-0.5 text-xs text-text-muted">
            Department of Computer Science &amp; Engineering
          </p>
          <p className="text-xs text-text-muted">University of Dhaka</p>

          <div className="mt-3 space-y-1">
            {member.email && (
              <p className="flex items-center gap-1.5 text-sm text-text-muted">
                <Mail className="h-4 w-4 flex-shrink-0 text-accent" />
                {member.email}
              </p>
            )}
            {member.phone && (
              <p className="flex items-center gap-1.5 text-sm text-text-muted">
                <Phone className="h-4 w-4 flex-shrink-0 text-accent" />
                {member.phone}
              </p>
            )}
          </div>

          <button className="mt-4 flex items-center gap-2 rounded-xl bg-cta px-4 py-2 text-sm font-semibold text-cta-text hover:opacity-90 transition">
            View Full Profile <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────

function DetailPanel({
  member,
  detail,
  loading,
  error,
  onClose,
  onRetry,
}: {
  member: FacultyMember
  detail: FacultyDetail | null
  loading: boolean
  error: string
  onClose: () => void
  onRetry: () => void
}) {
  const [showAllPubs, setShowAllPubs] = useState(false)
  const [panelImgFailed, setPanelImgFailed] = useState(false)
  const initials = member.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const d = detail ?? member
  const pubs = detail?.publications ?? []
  const visiblePubs = showAllPubs ? pubs : pubs.slice(0, 5)

  const PUB_TYPE_BADGE: Record<string, string> = {
    Journal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    Conference:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    'Book Chapter':
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    Other: 'bg-slate-100 text-slate-600 dark:bg-slate-800/30 dark:text-slate-300',
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-card overflow-y-auto shadow-2xl border-l border-border"
      >
        {/* Panel header */}
        <div className="bg-gradient-to-br from-primary via-secondary to-accent dark:bg-none dark:bg-[#1a3320] p-6 relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 transition"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-5">
            {d.photoUrl && !panelImgFailed ? (
              <img
                src={d.photoUrl}
                alt={d.name}
                className="h-28 w-28 rounded-full object-cover ring-4 ring-white/30 flex-shrink-0"
                loading="lazy"
                onError={() => setPanelImgFailed(true)}
              />
            ) : (
              <div
                className={`h-28 w-28 rounded-full flex items-center justify-center text-3xl font-bold text-white ring-4 ring-white/30 flex-shrink-0 ${RANK_AVATAR_BG[d.designationRank]}`}
              >
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold text-white leading-snug">
                {d.name || 'Faculty Member'}
              </h2>
              {d.designation && (
                <p className="mt-1 text-sm text-white/80">{d.designation}</p>
              )}
              <p className="text-xs text-white/60">
                Department of Computer Science &amp; Engineering
              </p>
              <p className="text-xs text-white/60">University of Dhaka</p>
            </div>
          </div>

          {/* Quick contact pills */}
          {(d.email || d.phone || member.officeRoom) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {d.email && (
                <a
                  href={`mailto:${d.email}`}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20 transition"
                >
                  <Mail className="h-3 w-3" /> {d.email}
                </a>
              )}
              {d.phone && (
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
                  <Phone className="h-3 w-3" /> {d.phone}
                </span>
              )}
              {member.officeRoom && (
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
                  <Building2 className="h-3 w-3" /> Room {member.officeRoom}
                </span>
              )}
            </div>
          )}

          {/* External links */}
          {detail && (
            <div className="mt-3 flex flex-wrap gap-2">
              {detail.googleScholarUrl && (
                <a
                  href={detail.googleScholarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white hover:bg-white/20 transition"
                >
                  <GraduationCap className="h-3 w-3" /> Scholar
                </a>
              )}
              {detail.researchGateUrl && (
                <a
                  href={detail.researchGateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white hover:bg-white/20 transition"
                >
                  <Link2 className="h-3 w-3" /> ResearchGate
                </a>
              )}
              {detail.orcidUrl && (
                <a
                  href={detail.orcidUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white hover:bg-white/20 transition"
                >
                  <Link2 className="h-3 w-3" /> ORCID
                </a>
              )}
              {detail.linkedinUrl && (
                <a
                  href={detail.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white hover:bg-white/20 transition"
                >
                  <Link2 className="h-3 w-3" /> LinkedIn
                </a>
              )}
              {detail.personalWebsite && (
                <a
                  href={detail.personalWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white hover:bg-white/20 transition"
                >
                  <ExternalLink className="h-3 w-3" /> Website
                </a>
              )}
              <a
                href={member.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white hover:bg-white/20 transition"
              >
                <ExternalLink className="h-3 w-3" /> DU Profile
              </a>
            </div>
          )}
        </div>

        {/* Panel body */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="text-sm">Loading profile details…</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted">
            <Signal className="h-10 w-10" />
            <p className="text-sm">{error}</p>
            <button
              onClick={onRetry}
              className="rounded-xl bg-cta px-4 py-2 text-sm font-semibold text-cta-text hover:opacity-90 transition"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && detail && (
          <div className="divide-y divide-border">
            {/* Education */}
            {(detail.bscDegree || detail.mscDegree || detail.phdDegree || detail.otherDegrees.length > 0) && (
              <Section
                title="Academic Background"
                icon={<GraduationCap className="h-4 w-4 text-accent" />}
              >
                <div className="space-y-2 text-sm">
                  {detail.phdDegree && (
                    <div className="flex gap-3">
                      <span className="w-10 flex-shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-center text-[10px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        PhD
                      </span>
                      <span className="text-text-primary">{detail.phdDegree}</span>
                    </div>
                  )}
                  {detail.mscDegree && (
                    <div className="flex gap-3">
                      <span className="w-10 flex-shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-center text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        MSc
                      </span>
                      <span className="text-text-primary">{detail.mscDegree}</span>
                    </div>
                  )}
                  {detail.bscDegree && (
                    <div className="flex gap-3">
                      <span className="w-10 flex-shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-center text-[10px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        BSc
                      </span>
                      <span className="text-text-primary">{detail.bscDegree}</span>
                    </div>
                  )}
                  {detail.otherDegrees.map((d, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="w-10 flex-shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-center text-[10px] font-bold text-slate-600 dark:bg-slate-800/30 dark:text-slate-300">
                        Deg
                      </span>
                      <span className="text-text-primary">{d}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Research interests */}
            {detail.researchInterests.length > 0 && (
              <Section
                title="Research Interests"
                icon={<FlaskConical className="h-4 w-4 text-accent" />}
              >
                <div className="flex flex-wrap gap-2">
                  {detail.researchInterests.map((interest, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Publications */}
            {pubs.length > 0 && (
              <Section
                title={`Publications (${pubs.length})`}
                icon={<FileText className="h-4 w-4 text-accent" />}
                defaultOpen={pubs.length <= 5}
              >
                <div className="space-y-3">
                  {visiblePubs.map((pub, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border bg-card p-3"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PUB_TYPE_BADGE[pub.type] ?? PUB_TYPE_BADGE.Other}`}
                        >
                          {pub.type}
                        </span>
                        {pub.year && (
                          <span className="text-[10px] text-text-muted">
                            {pub.year}
                          </span>
                        )}
                      </div>
                      {pub.url ? (
                        <a
                          href={pub.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-text-primary hover:text-accent transition line-clamp-2"
                        >
                          {pub.title}
                        </a>
                      ) : (
                        <p className="text-sm font-semibold text-text-primary line-clamp-2">
                          {pub.title}
                        </p>
                      )}
                      {pub.venue && (
                        <p className="mt-0.5 text-xs text-text-muted">
                          {pub.venue}
                        </p>
                      )}
                    </div>
                  ))}
                  {pubs.length > 5 && (
                    <button
                      onClick={() => setShowAllPubs((v) => !v)}
                      className="text-xs font-semibold text-accent hover:underline"
                    >
                      {showAllPubs
                        ? 'Show fewer'
                        : `Show all ${pubs.length} publications`}
                    </button>
                  )}
                </div>
              </Section>
            )}

            {/* Courses */}
            {detail.courses.length > 0 && (
              <Section
                title="Courses Taught"
                icon={<BookOpen className="h-4 w-4 text-accent" />}
              >
                <div className="flex flex-wrap gap-2">
                  {detail.courses.map((c, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-border bg-card px-3 py-1 text-xs text-text-primary"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Contact */}
            <Section
              title="Contact Information"
              icon={<Mail className="h-4 w-4 text-accent" />}
            >
              <div className="space-y-2 text-sm">
                {detail.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 flex-shrink-0 text-text-muted" />
                    <a
                      href={`mailto:${detail.email}`}
                      className="text-accent hover:underline"
                    >
                      {detail.email}
                    </a>
                  </div>
                )}
                {detail.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 flex-shrink-0 text-text-muted" />
                    <span className="text-text-primary">{detail.phone}</span>
                  </div>
                )}
                {detail.officeRoom && (
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 flex-shrink-0 text-text-muted" />
                    <span className="text-text-primary">
                      Room {detail.officeRoom}
                    </span>
                  </div>
                )}
                <div className="pt-2">
                  <a
                    href={member.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs font-semibold text-accent hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View official DU profile
                  </a>
                </div>
              </div>
            </Section>
          </div>
        )}
      </motion.div>
    </>
  )
}

// ── Main FacultyClient ────────────────────────────────────────

export default function FacultyClient() {
  const [faculty, setFaculty] = useState<FacultyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRank, setSelectedRank] = useState<DesignationRank | 'All'>('All')
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyMember | null>(null)
  const [detail, setDetail] = useState<FacultyDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api-faculty/list')
        const data = await res.json()
        if (data.error && !data.faculty?.length) {
          setError(data.error)
        } else {
          setFaculty(data.faculty ?? [])
        }
      } catch {
        setError('Failed to load faculty list. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function openDetail(member: FacultyMember) {
    setSelectedFaculty(member)
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      const res = await fetch(`/api-faculty/detail/${member.id}`)
      const data = await res.json()
      if (data.detail) {
        setDetail(data.detail)
      } else {
        setDetailError('Could not load profile details.')
      }
    } catch {
      setDetailError('Network error loading profile.')
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() {
    setSelectedFaculty(null)
    setDetail(null)
    setDetailError('')
  }

  // Filtering
  const filtered = faculty.filter((f) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      !q ||
      f.name.toLowerCase().includes(q) ||
      f.designation.toLowerCase().includes(q) ||
      f.email.toLowerCase().includes(q)
    const matchesRank =
      selectedRank === 'All' || f.designationRank === selectedRank
    return matchesSearch && matchesRank
  })

  // Group by rank
  const grouped = Object.fromEntries(
    RANKS.map((r) => [r, filtered.filter((f) => f.designationRank === r)])
  ) as Record<DesignationRank, FacultyMember[]>

  const totalDesignations = RANKS.filter((r) => grouped[r].length > 0).length

  return (
    <div className="space-y-6">
      {/* Sub-header */}
      <div className="overflow-hidden rounded-card shadow-lg">
        <div className="bg-gradient-to-r from-primary via-secondary to-accent dark:from-[#2b3245] dark:via-[#1e2838] dark:to-[#141d2b] p-6 md:p-8">
          <div className="flex items-start gap-3">
            <GraduationCap className="mt-1 h-8 w-8 flex-shrink-0 text-white/80" />
            <div>
              <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
                Department of CSE
              </h2>
              <p className="mt-1 text-sm text-white/70">
                University of Dhaka · Faculty Members
              </p>
              {!loading && !error && (
                <p className="mt-1 text-xs text-white/50">
                  {faculty.length} faculty members across {totalDesignations}{' '}
                  designations
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search + filter */}
      <div className="rounded-card border border-border bg-card p-4 shadow-[var(--shadow-card)] space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search by name, designation…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedRank('All')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              selectedRank === 'All'
                ? 'bg-cta text-cta-text'
                : 'border border-border bg-card text-text-muted hover:border-primary hover:text-primary'
            }`}
          >
            All
          </button>
          {RANKS.filter((r) => r !== 'Other').map((rank) => (
            <button
              key={rank}
              onClick={() => setSelectedRank(rank)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                selectedRank === rank
                  ? 'bg-accent text-white'
                  : 'border border-border bg-card text-text-muted hover:border-primary hover:text-primary'
              }`}
            >
              {rank}
            </button>
          ))}
        </div>

        {!loading && (
          <p className="text-xs text-text-muted">
            Showing {filtered.length} of {faculty.length} faculty members
          </p>
        )}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-card border border-border bg-card p-4 animate-pulse"
            >
              <div className="mx-auto mb-3 h-24 w-24 rounded-full bg-border" />
              <div className="mx-auto mb-2 h-4 w-3/4 rounded bg-border" />
              <div className="mx-auto h-3 w-1/2 rounded bg-border" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && faculty.length === 0 && (
        <div className="rounded-card border border-border bg-card p-10 shadow-[var(--shadow-card)] text-center">
          <Signal className="mx-auto mb-4 h-12 w-12 text-text-muted" />
          <h2 className="font-display mb-2 text-lg font-semibold text-text-primary">
            Could not connect to University of Dhaka server
          </h2>
          <p className="mb-4 text-sm text-text-muted">
            You can visit the official page directly:
          </p>
          <a
            href="https://www.du.ac.bd/body/FacultyMembers/CSE"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-cta px-5 py-2.5 text-sm font-semibold text-cta-text hover:opacity-90 transition"
          >
            View on DU website <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}

      {/* Faculty grouped list */}
      {!loading && (
        <div className="space-y-8">
          {RANKS.map((rank) => {
            const group = grouped[rank]
            if (!group || group.length === 0) return null

            return (
              <div key={rank} className="space-y-4">
                {/* Rank section header */}
                <div className="flex items-center gap-3 border-b border-border pb-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${RANK_BADGE_COLORS[rank]}`}
                  >
                    {rank}
                  </span>
                  <span className="text-xs text-text-muted">
                    {group.length} member{group.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Chairman: featured card */}
                {rank === 'Chairman' ? (
                  <motion.div
                    variants={{
                      hidden: {},
                      visible: { transition: { staggerChildren: 0.1 } },
                    }}
                    initial="hidden"
                    animate="visible"
                    className="space-y-4"
                  >
                    {group.map((member) => (
                      <ChairmanCard
                        key={member.id}
                        member={member}
                        onClick={() => openDetail(member)}
                      />
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    variants={{
                      hidden: {},
                      visible: { transition: { staggerChildren: 0.07 } },
                    }}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
                  >
                    {group.map((member) => (
                      <FacultyCard
                        key={member.id}
                        member={member}
                        onClick={() => openDetail(member)}
                      />
                    ))}
                  </motion.div>
                )}
              </div>
            )
          })}

          {/* Empty search state */}
          {!loading && filtered.length === 0 && faculty.length > 0 && (
            <div className="rounded-card border border-border bg-card p-10 text-center shadow-[var(--shadow-card)]">
              <Users className="mx-auto mb-3 h-10 w-10 text-text-muted" />
              <p className="mb-3 text-sm text-text-muted">
                No faculty members match your search.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedRank('All')
                }}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-text-muted hover:border-primary hover:text-primary transition"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail panel */}
      <AnimatePresence>
        {selectedFaculty && (
          <DetailPanel
            member={selectedFaculty}
            detail={detail}
            loading={detailLoading}
            error={detailError}
            onClose={closeDetail}
            onRetry={() => openDetail(selectedFaculty)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
