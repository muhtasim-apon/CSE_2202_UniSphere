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

// ── Faculty Types ──────────────────────────────────────────────

export type DesignationRank =
  | 'Chairman'
  | 'Professor'
  | 'Associate Professor'
  | 'Assistant Professor'
  | 'Lecturer'
  | 'Other'

export interface FacultyMember {
  id: string
  name: string
  designation: string
  designationRank: DesignationRank
  department: string
  photoUrl: string
  email: string
  phone: string
  officeRoom: string
  profileUrl: string
}

export interface FacultyDetail extends FacultyMember {
  bscDegree: string
  mscDegree: string
  phdDegree: string
  otherDegrees: string[]
  researchInterests: string[]
  publications: FacultyPublication[]
  personalWebsite: string
  googleScholarUrl: string
  linkedinUrl: string
  researchGateUrl: string
  orcidUrl: string
  biography: string
  officeHours: string
  courses: string[]
  awards: string[]
}

export interface FacultyPublication {
  title: string
  authors: string
  venue: string
  year: string
  url: string
  type: 'Journal' | 'Conference' | 'Book Chapter' | 'Other'
}

export const DESIGNATION_RANK_ORDER: Record<DesignationRank, number> = {
  Chairman:              0,
  Professor:             1,
  'Associate Professor': 2,
  'Assistant Professor': 3,
  Lecturer:              4,
  Other:                 5,
}

export function normalizeDesignation(raw: string): DesignationRank {
  const lower = raw.toLowerCase().trim()
  if (lower.includes('chairman') || lower.includes('chairperson')) return 'Chairman'
  if (lower.includes('associate professor')) return 'Associate Professor'
  if (lower.includes('assistant professor')) return 'Assistant Professor'
  if (lower.includes('professor')) return 'Professor'
  if (lower.includes('lecturer')) return 'Lecturer'
  return 'Other'
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
