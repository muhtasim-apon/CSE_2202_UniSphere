import { NextResponse } from 'next/server'

export const revalidate = 86400 // cache 24 h

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const imageUrl = searchParams.get('url')

  if (!imageUrl) {
    return new NextResponse('Missing url param', { status: 400 })
  }

  // Only proxy images from the DU domain — prevent SSRF
  let parsed: URL
  try {
    parsed = new URL(imageUrl)
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }
  
  const host = parsed.hostname.toLowerCase()
  const isDuAcBd = host === 'du.ac.bd' || host.endsWith('.du.ac.bd')
  const isDuEduBd = host === 'du.edu.bd' || host.endsWith('.du.edu.bd')
  if (!isDuAcBd && !isDuEduBd) {
    return new NextResponse('Forbidden host', { status: 403 })
  }

  try {
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://www.du.ac.bd/',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      next: { revalidate: 86400 },
    })

    if (!res.ok) {
      console.warn(`Image proxy failed to fetch ${imageUrl}: HTTP ${res.status}`)
      return new NextResponse('Image not found', { status: 404 })
    }

    const contentType = res.headers.get('Content-Type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      console.warn(`Image proxy got invalid content type: ${contentType} for ${imageUrl}`)
      return new NextResponse('Not an image', { status: 400 })
    }

    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error(`Image proxy error fetching ${imageUrl}:`, error)
    return new NextResponse('Proxy error', { status: 502 })
  }
}
