import { NextResponse } from 'next/server'
import { parseRssXml } from '@/app/lib/rssParser'

export const revalidate = 3600

export async function GET() {
  try {
    const res = await fetch('https://jmlr.org/jmlr.xml', {
      headers: { 'User-Agent': 'EduHub/1.0 (university-erp; educational)' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return NextResponse.json({ items: [] })
    const xml = await res.text()
    const items = parseRssXml(xml, 'JMLR')
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ items: [] })
  }
}
