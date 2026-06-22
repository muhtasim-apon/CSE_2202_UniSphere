'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen,
  ExternalLink,
  FileText,
  Globe,
  GraduationCap,
  Layers,
  Microscope,
  Newspaper,
  RefreshCw,
  Search,
  Signal,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { Article, ArticleSource, ArticleCategory } from './types'
import { SOURCE_JOURNALS } from './types'
import FacultyClient from './FacultyClient'

const SOURCE_BADGE: Record<ArticleSource, string> = {
  arXiv: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  'Dev.to': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400',
  'Hacker News': 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  'IEEE TPAMI': 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  JMLR: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
}

const CATEGORY_BADGE: Record<ArticleCategory, string> = {
  'Research Paper': 'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
  'Journal Article': 'bg-sky-100 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400',
  'Blog Post': 'bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400',
  'Tech News': 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
}

const JOURNAL_COLORS: Record<string, string> = {
  blue: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-500',
  red: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 hover:border-red-400 dark:hover:border-red-500',
  emerald: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-500',
  amber: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-500',
  purple: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-500',
}

const JOURNAL_ICON_BG: Record<string, string> = {
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  purple: 'bg-purple-500',
}

const JOURNAL_ICONS: Record<string, LucideIcon> = {
  ieee: BookOpen,
  acm: FileText,
  jmlr: Microscope,
  scholar: GraduationCap,
  arxiv: Layers,
}

const SOURCE_GRADIENT: Record<ArticleSource, string> = {
  arXiv: 'bg-gradient-to-br from-purple-600 via-indigo-700 to-slate-800',
  'Dev.to': 'bg-gradient-to-br from-pink-500 via-rose-600 to-red-700',
  'Hacker News': 'bg-gradient-to-br from-orange-500 via-amber-600 to-yellow-700',
  'IEEE TPAMI': 'bg-gradient-to-br from-blue-600 via-cyan-700 to-sky-800',
  JMLR: 'bg-gradient-to-br from-emerald-600 via-teal-700 to-green-800',
}

const CATEGORIES: ArticleCategory[] = ['Research Paper', 'Blog Post', 'Tech News', 'Journal Article']
const SOURCES: ArticleSource[] = ['arXiv', 'Dev.to', 'Hacker News', 'IEEE TPAMI', 'JMLR']

function formatDate(d: string): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return d
  }
}

export default function InfoTechClient({ articles }: { articles: Article[] }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'blogs' | 'faculty'>('blogs')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())
  const [visibleCount, setVisibleCount] = useState(15)
  const [expandedHero, setExpandedHero] = useState(false)
  const [lastUpdated] = useState(() => new Date())
  const [showRefreshBanner, setShowRefreshBanner] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowRefreshBanner(true), 5 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [])

  function handleRefresh() {
    setShowRefreshBanner(false)
    router.refresh()
  }

  const filtered = articles.filter(a => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (
        !a.title.toLowerCase().includes(q) &&
        !a.description.toLowerCase().includes(q) &&
        !a.authors.join(' ').toLowerCase().includes(q) &&
        !a.tags.join(' ').toLowerCase().includes(q)
      )
        return false
    }
    if (selectedCategories.size > 0 && !selectedCategories.has(a.category)) return false
    if (selectedSources.size > 0 && !selectedSources.has(a.source)) return false
    return true
  })

  function toggleCategory(cat: string) {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
    setVisibleCount(15)
  }

  function toggleSource(src: string) {
    setSelectedSources(prev => {
      const next = new Set(prev)
      next.has(src) ? next.delete(src) : next.add(src)
      return next
    })
    setVisibleCount(15)
  }

  const heroArticle = filtered[0]
  const gridArticles = filtered.slice(1, visibleCount)

  return (
    <div className="space-y-6">
      {/* Auto-refresh banner */}
      <AnimatePresence>
        {showRefreshBanner && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="fixed left-1/2 top-20 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-accent bg-card px-5 py-3 shadow-lg"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            <span className="text-sm font-medium text-text-primary">New articles available</span>
            <button
              onClick={handleRefresh}
              className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
            >
              Refresh
            </button>
            <button onClick={() => setShowRefreshBanner(false)} className="text-text-muted hover:text-primary">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="overflow-hidden rounded-card shadow-lg">
          <div className="bg-gradient-to-r from-primary via-secondary to-accent dark:from-[#2b3245] dark:via-[#1e2838] dark:to-[#141d2b] p-6 md:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <Newspaper className="mt-1 h-8 w-8 flex-shrink-0 text-white/80" />
                <div>
                  <h1 className="font-display text-2xl font-bold text-white md:text-3xl">
                    Information &amp; Technology
                  </h1>
                  <p className="mt-1 text-sm text-white/70">
                    Live CS research, developer blogs and tech news
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                  LIVE
                </span>
                <span className="text-sm font-medium text-white/70">
                  {articles.length} articles
                </span>
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-2 rounded-xl bg-card/50 p-1 border border-border w-fit">
        <button
          onClick={() => setActiveTab('blogs')}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
            activeTab === 'blogs'
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-muted hover:text-primary'
          }`}
        >
          <Newspaper className="h-4 w-4" />
          Tech Blogs
        </button>
        <button
          onClick={() => setActiveTab('faculty')}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
            activeTab === 'faculty'
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-muted hover:text-primary'
          }`}
        >
          <Users className="h-4 w-4" />
          CSE Faculty
          <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent">
            DU
          </span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'faculty' && (
          <motion.div
            key="faculty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            <FacultyClient />
          </motion.div>
        )}
        {activeTab === 'blogs' && (
          <motion.div
            key="blogs"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >

      {/* Error state */}
      {articles.length === 0 && (
        <div className="rounded-card border border-border bg-card p-10 shadow-[var(--shadow-card)] text-center">
          <Signal className="mx-auto mb-4 h-12 w-12 text-text-muted" />
          <h2 className="font-display mb-2 text-lg font-semibold text-text-primary">
            Unable to load content right now
          </h2>
          <p className="mb-6 text-sm text-text-muted">
            Check your connection or try refreshing the page.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {SOURCE_JOURNALS.map(j => (
              <a
                key={j.id}
                href={j.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition hover:border-primary hover:text-primary"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {j.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {articles.length > 0 && (
        <>
          {/* Featured Journals Strip */}
          <div>
            <p className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-text-primary">
              <Globe className="h-4 w-4 text-accent" />
              Top CS Journals &amp; Resources
            </p>
            <div className="flex gap-4 overflow-x-auto pb-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {SOURCE_JOURNALS.map(journal => {
                const Icon = JOURNAL_ICONS[journal.id]
                return (
                  <a
                    key={journal.id}
                    href={journal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group min-w-[220px] flex-shrink-0 rounded-card border p-4 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg ${JOURNAL_COLORS[journal.color]}`}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${JOURNAL_ICON_BG[journal.color]}`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-display text-sm font-bold leading-tight text-text-primary">
                        {journal.name}
                      </span>
                    </div>
                    <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-text-muted">
                      {journal.description}
                    </p>
                    <span className="flex items-center gap-1 text-xs font-semibold text-accent transition-all duration-200 group-hover:gap-2">
                      Visit Journal <ExternalLink className="h-3 w-3" />
                    </span>
                  </a>
                )
              })}
            </div>
          </div>

          {/* Search + Filter Bar */}
          <div className="rounded-card border border-border bg-card p-4 shadow-[var(--shadow-card)] space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search articles, authors, topics…"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setVisibleCount(15) }}
                className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setSelectedCategories(new Set()); setVisibleCount(15) }}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                  selectedCategories.size === 0
                    ? 'bg-primary text-white'
                    : 'border border-border bg-card text-text-muted hover:border-primary hover:text-primary'
                }`}
              >
                All
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                    selectedCategories.has(cat)
                      ? 'bg-accent text-white'
                      : 'border border-border bg-card text-text-muted hover:border-primary hover:text-primary'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {SOURCES.map(src => (
                <button
                  key={src}
                  onClick={() => toggleSource(src)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    selectedSources.has(src)
                      ? 'bg-primary text-white'
                      : 'border border-border bg-card text-text-muted hover:border-primary hover:text-primary'
                  }`}
                >
                  {src}
                </button>
              ))}
            </div>

            <p className="text-xs text-text-muted">
              Showing {filtered.length} of {articles.length} articles
            </p>
          </div>

          {/* No results */}
          {filtered.length === 0 && (
            <div className="rounded-card border border-border bg-card p-10 shadow-[var(--shadow-card)] text-center">
              <Search className="mx-auto mb-3 h-10 w-10 text-text-muted" />
              <p className="text-sm text-text-muted">No articles found matching your filters.</p>
            </div>
          )}

          {filtered.length > 0 && (
            <>
              {/* Hero Article */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <article className="overflow-hidden rounded-card border border-border bg-card shadow-[var(--shadow-card)]">
                  {/* Cover */}
                  <div className="relative h-56 w-full overflow-hidden md:h-72">
                    {heroArticle.source === 'Dev.to' && heroArticle.coverImage ? (
                      <img
                        src={heroArticle.coverImage}
                        alt={heroArticle.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center ${SOURCE_GRADIENT[heroArticle.source]}`}>
                        <span className="select-none font-display text-8xl font-black text-white/20">
                          {heroArticle.source.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <div className="absolute bottom-4 left-4 flex gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SOURCE_BADGE[heroArticle.source]}`}>
                        {heroArticle.source}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CATEGORY_BADGE[heroArticle.category]}`}>
                        {heroArticle.category}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5 md:p-6">
                    <h2 className="font-display mb-3 text-xl font-bold leading-snug text-text-primary md:text-2xl">
                      {heroArticle.title}
                    </h2>

                    {(heroArticle.authors.length > 0 || heroArticle.publishedAt) && (
                      <p className="mb-3 text-xs text-text-muted">
                        {heroArticle.authors.length > 0 && (
                          <span>
                            By {heroArticle.authors.slice(0, 3).join(', ')}
                            {heroArticle.authors.length > 3 && ` +${heroArticle.authors.length - 3} more`}
                          </span>
                        )}
                        {heroArticle.authors.length > 0 && heroArticle.publishedAt && <span> · </span>}
                        {heroArticle.publishedAt && <span>{formatDate(heroArticle.publishedAt)}</span>}
                      </p>
                    )}

                    {heroArticle.description && (
                      <div className="mb-4">
                        <p className={`text-sm leading-relaxed text-text-primary ${expandedHero ? '' : 'line-clamp-3'}`}>
                          {heroArticle.description}
                        </p>
                        {heroArticle.description.length > 200 && (
                          <button
                            onClick={() => setExpandedHero(v => !v)}
                            className="mt-1 text-xs font-medium text-accent hover:underline"
                          >
                            {expandedHero ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <a
                        href={heroArticle.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                      >
                        Open Article <ExternalLink className="h-4 w-4" />
                      </a>
                      {heroArticle.readingTime && (
                        <span className="text-xs text-text-muted">📖 {heroArticle.readingTime} min read</span>
                      )}
                      {heroArticle.score && (
                        <span className="text-xs text-text-muted">⬆ {heroArticle.score} points</span>
                      )}
                    </div>
                  </div>
                </article>
              </motion.div>

              {/* Article Grid */}
              {gridArticles.length > 0 && (
                <motion.div
                  variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
                >
                  {gridArticles.map(article => (
                    <motion.article
                      key={article.id}
                      variants={{
                        hidden: { opacity: 0, y: 24, scale: 0.97 },
                        visible: {
                          opacity: 1,
                          y: 0,
                          scale: 1,
                          transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
                        },
                      }}
                      className="group flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-[var(--shadow-card)] transition-shadow hover:shadow-lg"
                    >
                      {/* Card cover */}
                      <div className="relative aspect-video w-full overflow-hidden">
                        {article.source === 'Dev.to' && article.coverImage ? (
                          <img
                            src={article.coverImage}
                            alt={article.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className={`flex h-full w-full items-center justify-center ${SOURCE_GRADIENT[article.source]}`}>
                            <span className="select-none font-display text-5xl font-black text-white/20">
                              {article.source.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        <div className="absolute bottom-2 left-2">
                          <span className="rounded-full border border-white/20 bg-black/30 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                            {article.source}
                          </span>
                        </div>
                      </div>

                      {/* Card content */}
                      <div className="flex flex-1 flex-col justify-between p-4">
                        <div>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_BADGE[article.category]}`}>
                              {article.category}
                            </span>
                            <span className="text-[10px] text-text-muted">{formatDate(article.publishedAt)}</span>
                          </div>
                          <h3 className="font-display mb-1.5 line-clamp-2 text-sm font-bold leading-snug text-text-primary transition-colors duration-200 group-hover:text-accent">
                            {article.title}
                          </h3>
                          {article.authors.length > 0 && (
                            <p className="mb-2 line-clamp-1 text-[11px] text-text-muted">
                              {article.authors.slice(0, 2).join(', ')}
                              {article.authors.length > 2 ? ' et al.' : ''}
                            </p>
                          )}
                          {article.description && (
                            <p className="line-clamp-3 text-xs leading-relaxed text-text-muted">
                              {article.description}
                            </p>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-90 active:scale-95"
                          >
                            Read Article <ExternalLink className="h-3 w-3" />
                          </a>
                          <div className="flex items-center gap-2 text-[11px] text-text-muted">
                            {article.readingTime && <span>📖 {article.readingTime}m</span>}
                            {article.score && <span>⬆ {article.score}</span>}
                          </div>
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </motion.div>
              )}

              {/* Load More */}
              {visibleCount < filtered.length && (
                <button
                  onClick={() => setVisibleCount(v => v + 15)}
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Load more ({filtered.length - visibleCount} remaining)
                </button>
              )}
            </>
          )}
        </>
      )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
