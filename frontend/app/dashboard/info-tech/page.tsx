export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '../components/DashboardShell'
import SignOutButton from '../sign-out-button'
import InfoTechClient from './InfoTechClient'
import type { Article } from './types'
import { parseRssXml } from '@/app/lib/rssParser'

function extractAtomTag(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = xml.match(
    new RegExp(
      `<${escaped}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${escaped}>|<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`
    )
  )
  return (m?.[1] ?? m?.[2] ?? '').trim()
}

export async function fetchArxiv(): Promise<Article[]> {
  try {
    const res = await fetch(
      'https://export.arxiv.org/api/query?search_query=cat:cs.CV+OR+cat:cs.LG+OR+cat:cs.AI+OR+cat:cs.NE&sortBy=submittedDate&sortOrder=descending&max_results=15',
      { cache: 'no-store' }
    )
    if (!res.ok) return []
    const xml = await res.text()
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
    const articles: Article[] = []
    let match
    while ((match = entryRegex.exec(xml)) !== null) {
      const block = match[1]
      const id = extractAtomTag(block, 'id')
      const title = extractAtomTag(block, 'title').replace(/\s+/g, ' ').trim()
      const summary = extractAtomTag(block, 'summary').replace(/\s+/g, ' ').trim()
      const authorMatches = [...block.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)]
      const authors = authorMatches.map(m => m[1].trim())
      const published = extractAtomTag(block, 'published')
      const catMatches = [...block.matchAll(/<category[^>]+term="([^"]+)"/g)]
      const tags = catMatches.map(m => m[1])
      if (id && title) {
        articles.push({
          id,
          title,
          description: summary.slice(0, 300),
          url: id,
          source: 'arXiv',
          category: 'Research Paper',
          authors,
          publishedAt: published,
          tags,
        })
      }
    }
    return articles
  } catch {
    return []
  }
}

export async function fetchDevTo(): Promise<Article[]> {
  try {
    const [res1, res2] = await Promise.all([
      fetch('https://dev.to/api/articles?per_page=15&tag=programming&top=5',
        { cache: 'no-store' }),
      fetch('https://dev.to/api/articles?per_page=10&tag=machinelearning&top=5',
        { cache: 'no-store' }),
    ])
    const [data1, data2]: [any[], any[]] = await Promise.all([
      res1.ok ? res1.json() : Promise.resolve([]),
      res2.ok ? res2.json() : Promise.resolve([]),
    ])
    const combined = [...data1, ...data2]
    const seen = new Set<number>()
    const deduped = combined.filter(item => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    deduped.sort((a, b) => (b.positive_reactions_count ?? 0) - (a.positive_reactions_count ?? 0))
    return deduped.slice(0, 15).map(item => ({
      id: String(item.id),
      title: item.title ?? '',
      description: (item.description ?? '').slice(0, 300),
      url: item.url ?? '',
      source: 'Dev.to' as const,
      category: 'Blog Post' as const,
      authors: item.user?.name ? [item.user.name] : [],
      publishedAt: item.published_at ?? '',
      tags: item.tag_list ?? [],
      coverImage: item.cover_image ?? undefined,
      readingTime: item.reading_time_minutes ?? undefined,
    }))
  } catch {
    return []
  }
}

export async function fetchHackerNews(): Promise<Article[]> {
  try {
    const idsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
      cache: 'no-store',
    })
    if (!idsRes.ok) return []
    const ids: number[] = await idsRes.json()
    const top30 = ids.slice(0, 30)
    const items = await Promise.all(
      top30.map(id =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { cache: 'no-store' })
          .then(r => r.json())
          .catch(() => null)
      )
    )
    return items
      .filter(item => item && item.type === 'story' && item.score > 50 && item.url)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(item => ({
        id: String(item.id),
        title: item.title ?? '',
        description: '',
        url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
        source: 'Hacker News' as const,
        category: 'Tech News' as const,
        authors: item.by ? [item.by] : [],
        publishedAt: item.time ? new Date(item.time * 1000).toISOString() : '',
        tags: [],
        score: item.score,
      }))
  } catch {
    return []
  }
}

export async function fetchIeee(): Promise<Article[]> {
  try {
    const res = await fetch('https://ieeexplore.ieee.org/rss/TOC10.XML', {
      headers: { 'User-Agent': 'EduHub/1.0 (university-erp; educational)' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseRssXml(xml, 'IEEE TPAMI').map(item => ({
      id: item.link || item.title,
      title: item.title,
      description: item.description.slice(0, 300),
      url: item.link,
      source: 'IEEE TPAMI' as const,
      category: 'Journal Article' as const,
      authors: item.author && item.author !== 'IEEE TPAMI' ? [item.author] : [],
      publishedAt: item.pubDate,
      tags: [],
    }))
  } catch {
    return []
  }
}

export async function fetchJmlr(): Promise<Article[]> {
  try {
    const res = await fetch('https://jmlr.org/jmlr.xml', {
      headers: { 'User-Agent': 'EduHub/1.0 (university-erp; educational)' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseRssXml(xml, 'JMLR').map(item => ({
      id: item.link || item.title,
      title: item.title,
      description: item.description.slice(0, 300),
      url: item.link,
      source: 'JMLR' as const,
      category: 'Research Paper' as const,
      authors: item.author && item.author !== 'JMLR' ? [item.author] : [],
      publishedAt: item.pubDate,
      tags: [],
    }))
  } catch {
    return []
  }
}

export default async function InfoTechPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const firstName = profile?.first_name || user.email?.split('@')[0] || 'Student'
  const lastName = profile?.last_name || ''
  const initials = `${firstName.charAt(0)}${lastName.charAt(0) || ''}`.toUpperCase()

  const results = await Promise.allSettled([
    fetchArxiv(),
    fetchDevTo(),
    fetchHackerNews(),
    fetchIeee(),
    fetchJmlr(),
  ])

  const allArticles = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
  const seen = new Set<string>()
  const deduped = allArticles.filter(a => {
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

  return (
    <DashboardShell
      firstName={firstName}
      email={user.email ?? ''}
      initials={initials}
      avatarUrl={profile?.avatar_url}
      signOutButton={<SignOutButton />}
      activeItem="info-tech"
    >
      <InfoTechClient articles={deduped} />
    </DashboardShell>
  )
}
