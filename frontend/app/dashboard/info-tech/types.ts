export type ArticleSource = 'arXiv' | 'Dev.to' | 'Hacker News' | 'IEEE TPAMI' | 'JMLR'
export type ArticleCategory = 'Research Paper' | 'Blog Post' | 'Tech News' | 'Journal Article'

export interface Article {
  id: string
  title: string
  description: string
  url: string
  source: ArticleSource
  category: ArticleCategory
  authors: string[]
  publishedAt: string
  tags: string[]
  coverImage?: string
  score?: number
  readingTime?: number
  doi?: string
}

export const SOURCE_JOURNALS = [
  {
    id: 'ieee',
    name: 'IEEE TPAMI',
    description: 'Premier journal globally for AI, ML & Computer Vision',
    url: 'https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=34',
    color: 'blue',
  },
  {
    id: 'acm',
    name: 'ACM Computing Surveys',
    description: 'Top-tier review articles summarizing major CS developments',
    url: 'https://dl.acm.org/journal/csur',
    color: 'red',
  },
  {
    id: 'jmlr',
    name: 'JMLR',
    description: 'Open-access venue for premier AI and ML research',
    url: 'https://www.jmlr.org/',
    color: 'emerald',
  },
  {
    id: 'scholar',
    name: 'Google Scholar Top Venues',
    description: 'Top CS venues ranked globally by h-index',
    url: 'https://scholar.google.com/citations?view_op=top_venues&hl=en&vq=eng',
    color: 'amber',
  },
  {
    id: 'arxiv',
    name: 'arXiv CS',
    description: 'Open-access preprints across CS, AI, and ML',
    url: 'https://arxiv.org/list/cs/recent',
    color: 'purple',
  },
] as const
