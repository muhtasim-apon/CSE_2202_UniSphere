import { NextResponse } from 'next/server'
import {
  normalizeDesignation,
  DESIGNATION_RANK_ORDER,
  type FacultyMember,
} from '@/app/dashboard/info-tech/types'

const DU_LIST_URL = 'https://www.du.ac.bd/body/FacultyMembers/CSE'
const BASE_URL = 'https://www.du.ac.bd'

export const revalidate = 3600

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
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

function parseFacultyList(html: string, baseUrl: string): FacultyMember[] {
  const members: FacultyMember[] = []
  const seen = new Set<string>()

  // Find every link to a faculty detail page
  const linkPattern = /href="([^"]*\/body\/faculty_details\/CSE\/(\d+)[^"]*)"/gi
  let linkMatch: RegExpExecArray | null

  while ((linkMatch = linkPattern.exec(html)) !== null) {
    const id = linkMatch[2]
    if (seen.has(id)) continue
    seen.add(id)

    // Look at HTML context before this link (up to 1500 chars back)
    const ctxStart = Math.max(0, linkMatch.index - 1500)
    const context = html.slice(ctxStart, linkMatch.index + 200)

    // Photo: any img in the context block
    let photoUrl = ''
    const imgMatch =
      context.match(/<img[^>]+src="([^"]+)"[^>]*>/i) ||
      context.match(/<img[^>]+src='([^']+)'[^>]*>/i)
    if (imgMatch) {
      const src = imgMatch[1]
      // Skip tiny icons / logos (common false positives on DU site)
      if (
        !src.includes('logo') &&
        !src.includes('icon') &&
        !src.includes('banner') &&
        !src.includes('btn') &&
        src.length > 10
      ) {
        photoUrl = makeAbsolute(src, baseUrl)
      }
    }

    // Name: look for h3/h4/h5/strong/b tags
    const namePatterns = [
      /<(?:h[3-5]|strong|b)[^>]*>([^<]{3,80})<\/(?:h[3-5]|strong|b)>/gi,
    ]
    let name = ''
    for (const pat of namePatterns) {
      pat.lastIndex = 0
      const allMatches = [...context.matchAll(pat)]
      if (allMatches.length > 0) {
        // Take the last match (closest to the profile link)
        const last = allMatches[allMatches.length - 1]
        const candidate = stripTags(last[1]).trim()
        // Must look like a person's name (has letters, not too short)
        if (candidate.length > 3 && /[a-zA-Z]/.test(candidate)) {
          name = candidate
          break
        }
      }
    }

    // Designation: extract from p/span/div tags near the profile link
    let designation = ''

    // Strategy 1: look for a tag whose text content IS a designation keyword
    // Handles: <p>(Professor)</p>  <p>Professor</p>  <span>Associate Professor</span>
    const tagDesigPattern = /<(?:p|span|td|div)[^>]*>\s*\(?([^<()]{0,40}(?:Professor|Lecturer|Chairman|Chairperson|Instructor)[^<()]{0,40})\)?\s*<\/(?:p|span|td|div)>/gi
    const tagDesigMatches = [...context.matchAll(tagDesigPattern)]
    if (tagDesigMatches.length > 0) {
      designation = stripTags(tagDesigMatches[tagDesigMatches.length - 1][1])
        .replace(/[()]/g, '')
        .trim()
    }

    // Strategy 2: plain-text scan for designation keywords (no leading-char requirement)
    if (!designation) {
      const plainMatch = context.match(
        /\(?((?:Associate\s+|Assistant\s+)?(?:Professor|Lecturer|Chairman|Chairperson|Instructor)(?:\s*(?:&|and)\s*\w+)*)\)?/i
      )
      if (plainMatch) {
        designation = plainMatch[1].trim()
      }
    }

    // Email
    const emailMatch = context.match(/[\w.+-]+@[\w.-]+\.\w{2,6}/i)
    const email = emailMatch ? emailMatch[0].trim() : ''

    // Phone
    const phoneMatch = context.match(
      /(?:Phone|Mobile|Cell|Tel)[:\s]*([+\d\s().-]{7,25})/i
    )
    const phone = phoneMatch ? phoneMatch[1].trim() : ''

    if (!name) continue

    members.push({
      id,
      name,
      designation,
      designationRank: normalizeDesignation(designation),
      department: 'CSE',
      photoUrl,
      email,
      phone,
      officeRoom: '',
      profileUrl: `${baseUrl}/body/faculty_details/CSE/${id}`,
    })
  }

  members.sort(
    (a, b) =>
      DESIGNATION_RANK_ORDER[a.designationRank] -
      DESIGNATION_RANK_ORDER[b.designationRank]
  )

  return members
}

export async function GET() {
  try {
    const res = await fetch(DU_LIST_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        Referer: 'https://www.du.ac.bd/',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `DU server returned ${res.status}`, faculty: [] },
        { status: 200 }
      )
    }

    const html = await res.text()
    const faculty = parseFacultyList(html, BASE_URL)

    return NextResponse.json({ faculty, fetchedAt: new Date().toISOString() })
  } catch (err) {
    console.error('Faculty list fetch error:', err)
    return NextResponse.json(
      { error: 'Network error', faculty: [] },
      { status: 200 }
    )
  }
}
