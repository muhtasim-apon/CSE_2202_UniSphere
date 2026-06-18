import { NextResponse } from 'next/server'
import {
  normalizeDesignation,
  type FacultyDetail,
  type FacultyPublication,
} from '@/app/dashboard/info-tech/types'

const BASE_URL = 'https://www.du.ac.bd'

export const revalidate = 7200

// ── Helpers ───────────────────────────────────────────────────

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, (c) => String.fromCharCode(parseInt(c.slice(2, -1))))
    .replace(/\s+/g, ' ')
    .trim()
}

function makeAbsolute(url: string, base: string): string {
  if (!url) return ''
  const cleaned = url.replace(/^http:\/\//, 'https://')
  if (cleaned.startsWith('https://')) return cleaned
  if (cleaned.startsWith('//')) return 'https:' + cleaned
  if (cleaned.startsWith('/')) return base + cleaned
  return base + '/' + cleaned
}

function between(html: string, start: string, end: string): string {
  const si = html.indexOf(start)
  if (si === -1) return ''
  const ei = html.indexOf(end, si + start.length)
  if (ei === -1) return html.slice(si + start.length)
  return html.slice(si + start.length, ei)
}

function extractSectionAfterHeading(html: string, headings: string[]): string {
  for (const heading of headings) {
    const idx = html.toLowerCase().indexOf(heading.toLowerCase())
    if (idx !== -1) {
      return html.slice(idx, idx + 3000)
    }
  }
  return ''
}

// ── Parsers ───────────────────────────────────────────────────

function parseEducation(html: string): {
  bsc: string
  msc: string
  phd: string
  others: string[]
} {
  const result = { bsc: '', msc: '', phd: '', others: [] as string[] }
  const section = extractSectionAfterHeading(html, [
    'Academic Background',
    'Education',
    'Degree',
  ])
  if (!section) return result

  // Parse table rows: <tr><td>Degree</td><td>Major</td><td>Institute</td><td>Country</td><td>Year</td></tr>
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const rows = [...section.matchAll(rowPattern)]

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (m) => stripTags(m[1])
    )
    if (cells.length < 2) continue
    const degree = cells[0].toLowerCase()
    const institute = cells[2] ?? ''
    const year = cells[4] ?? cells[3] ?? ''
    const label = [cells[0], cells[1], institute, year]
      .filter(Boolean)
      .join(', ')

    if (degree.includes('ph.d') || degree.includes('phd')) {
      result.phd = label
    } else if (
      degree.includes('m.sc') ||
      degree.includes('msc') ||
      degree.includes('m.s.') ||
      degree.includes('master')
    ) {
      result.msc = label
    } else if (
      degree.includes('b.sc') ||
      degree.includes('bsc') ||
      degree.includes('b.s.') ||
      degree.includes('bachelor')
    ) {
      result.bsc = label
    } else if (cells[0] && !cells[0].toLowerCase().includes('degree')) {
      result.others.push(label)
    }
  }

  return result
}

function parseResearchInterests(html: string): string[] {
  const section = extractSectionAfterHeading(html, [
    'Research Interest',
    'Area of Interest',
    'Research Area',
    'Specialization',
  ])
  if (!section) return []

  const interests: string[] = []

  // Try table rows first
  const rows = [...section.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    for (const cell of cells) {
      const text = stripTags(cell[1]).trim()
      if (text && text.length > 2 && !text.toLowerCase().includes('subject')) {
        interests.push(text)
      }
    }
  }
  if (interests.length > 0) return interests

  // Try list items
  const listItems = [...section.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  for (const li of listItems) {
    const text = stripTags(li[1]).trim()
    if (text && text.length > 2) interests.push(text)
  }
  if (interests.length > 0) return interests

  // Try comma-separated plain text in first p after heading
  const pMatch = section.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
  if (pMatch) {
    const text = stripTags(pMatch[1])
    if (text.includes(',')) {
      return text.split(',').map((s) => s.trim()).filter(Boolean)
    }
    if (text.length > 3) return [text]
  }

  return []
}

function parsePublications(
  html: string,
  sectionName: string,
  type: FacultyPublication['type']
): FacultyPublication[] {
  const idx = html.toLowerCase().indexOf(sectionName.toLowerCase())
  if (idx === -1) return []

  // Get content from this heading to the next h3/h2/h1
  const afterHeading = html.slice(idx)
  const nextHeadingMatch = afterHeading.match(/<h[1-3][^>]*>/, )
  const sectionHtml = nextHeadingMatch?.index
    ? afterHeading.slice(0, nextHeadingMatch.index + afterHeading.search(/<h[1-3][^>]*>/))
    : afterHeading.slice(0, 5000)

  const pubs: FacultyPublication[] = []

  // Try ordered list
  const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi
  const items = [...sectionHtml.matchAll(liPattern)]

  for (const item of items) {
    const raw = stripTags(item[1]).trim()
    if (!raw || raw.length < 10) continue

    // Extract year (4 digit number)
    const yearMatch = raw.match(/\b(19|20)\d{2}\b/)
    const year = yearMatch ? yearMatch[0] : ''

    // Try to extract venue from italic tags before stripping
    const venueMatch = item[1].match(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/i)
    const venue = venueMatch ? stripTags(venueMatch[1]).trim() : ''

    // Extract URL from link in item
    const urlMatch = item[1].match(/href="([^"]+)"/i)
    const url = urlMatch ? makeAbsolute(urlMatch[1], BASE_URL) : ''

    pubs.push({
      title: raw.slice(0, 200),
      authors: '',
      venue,
      year,
      url,
      type,
    })
  }

  return pubs
}

function extractExternalLinks(html: string): {
  scholar: string
  researchgate: string
  orcid: string
  linkedin: string
  personal: string
} {
  const links = { scholar: '', researchgate: '', orcid: '', linkedin: '', personal: '' }
  const hrefPattern = /href="(https?:\/\/[^"]+)"/gi
  let m: RegExpExecArray | null

  while ((m = hrefPattern.exec(html)) !== null) {
    const href = m[1]
    if (!links.scholar && href.includes('scholar.google')) links.scholar = href
    else if (!links.researchgate && href.includes('researchgate.net')) links.researchgate = href
    else if (!links.orcid && href.includes('orcid.org')) links.orcid = href
    else if (!links.linkedin && href.includes('linkedin.com')) links.linkedin = href
    else if (
      !links.personal &&
      !href.includes('du.ac.bd') &&
      !href.includes('facebook') &&
      !href.includes('twitter') &&
      !href.includes('youtube') &&
      !href.includes('google.com')
    ) {
      links.personal = href
    }
  }

  return links
}

function parseFacultyDetail(
  html: string,
  id: string,
  baseUrl: string
): FacultyDetail {
  // Photo: img with alt="Thumb" or alt containing "photo"
  let photoUrl = ''
  const photoPatterns = [
    /<img[^>]+alt="(?:Thumb|thumb|Photo|photo|profile|Profile)"[^>]+src="([^"]+)"/i,
    /<img[^>]+src="([^"]+)"[^>]+alt="(?:Thumb|thumb|Photo|photo|profile|Profile)"/i,
    // DU typically has faculty image in a known path
    /<img[^>]+src="([^"]*faculty_image[^"]+)"/i,
    /<img[^>]+src="([^"]*\/img\/cse_[^"]+)"/i,
    /<img[^>]+src="([^"]*\/upload\/img\/[^"]+)"/i,
  ]
  for (const pat of photoPatterns) {
    const m = html.match(pat)
    if (m) {
      photoUrl = makeAbsolute(m[1], baseUrl)
      break
    }
  }

  // Name: first h4 in page content (skip nav/header)
  const contentStart = html.indexOf('<h4')
  const nameMatch = html.slice(contentStart > 0 ? contentStart : 0).match(/<h4[^>]*>([^<]+)<\/h4>/i)
  const name = nameMatch ? stripTags(nameMatch[1]).trim() : ''

  // Designation: p containing (Professor), (Lecturer), etc.
  const desigMatch = html.match(/<p[^>]*>\s*\(([^)]{3,60})\)\s*<\/p>/i)
  const designation = desigMatch ? desigMatch[1].trim() : ''

  // Email
  const emailMatch = html.match(/[\w.+-]+@[\w.-]+\.(?:ac\.bd|edu|com|org)/i)
  const email = emailMatch ? emailMatch[0].trim() : ''

  // Phone
  const phoneMatch = html.match(
    /(?:Phone|Tel|Mobile|Cell)[:\s]*([+\d\s().-]{7,25})/i
  )
  const phone = phoneMatch ? phoneMatch[1].trim() : ''

  // Office room
  const roomMatch = html.match(/(?:Room|Office)[:\s#]*([A-Z\d-]{2,15})/i)
  const officeRoom = roomMatch ? roomMatch[1].trim() : ''

  // Education
  const edu = parseEducation(html)

  // Research interests
  const researchInterests = parseResearchInterests(html)

  // Publications
  const journalPubs = parsePublications(html, 'Journal Article', 'Journal')
  const confPubs = parsePublications(html, 'Conference Proceedings', 'Conference')
  const confPubs2 = parsePublications(html, 'Conference Paper', 'Conference')
  const bookPubs = parsePublications(html, 'Book Chapter', 'Book Chapter')
  const publications = [...journalPubs, ...confPubs, ...confPubs2, ...bookPubs]

  // External links
  const extLinks = extractExternalLinks(html)

  return {
    id,
    name,
    designation,
    designationRank: normalizeDesignation(designation),
    department: 'CSE',
    photoUrl,
    email,
    phone,
    officeRoom,
    profileUrl: `${baseUrl}/body/faculty_details/CSE/${id}`,
    bscDegree: edu.bsc,
    mscDegree: edu.msc,
    phdDegree: edu.phd,
    otherDegrees: edu.others,
    researchInterests,
    publications,
    personalWebsite: extLinks.personal,
    googleScholarUrl: extLinks.scholar,
    linkedinUrl: extLinks.linkedin,
    researchGateUrl: extLinks.researchgate,
    orcidUrl: extLinks.orcid,
    biography: '',
    officeHours: '',
    courses: [],
    awards: [],
  }
}

// ── Route Handler ─────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid faculty ID' }, { status: 400 })
  }

  const url = `${BASE_URL}/body/faculty_details/CSE/${id}`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Referer: 'https://www.du.ac.bd/body/FacultyMembers/CSE',
      },
      next: { revalidate: 7200 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `DU returned ${res.status}` },
        { status: 200 }
      )
    }

    const html = await res.text()
    const detail = parseFacultyDetail(html, id, BASE_URL)

    return NextResponse.json({ detail, fetchedAt: new Date().toISOString() })
  } catch (err) {
    console.error('Faculty detail fetch error:', err)
    return NextResponse.json({ error: 'Network error' }, { status: 200 })
  }
}
