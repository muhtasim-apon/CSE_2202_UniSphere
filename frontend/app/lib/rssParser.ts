export interface RssItem {
  title: string
  link: string
  description: string
  pubDate: string
  author: string
}

export function parseRssXml(xml: string, defaultAuthor: string): RssItem[] {
  // RSS uses <item>; Atom uses <entry>. Accept either so Atom-only feeds don't
  // silently yield nothing.
  const itemRegex = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g
  const items: RssItem[] = []
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[2]
    items.push({
      title: decodeEntities(extractTag(block, 'title')),
      link: extractLinkFromBlock(block),
      description: stripHtml(extractTag(block, 'description')),
      pubDate: extractTag(block, 'pubDate'),
      author: extractTag(block, 'author') || extractTag(block, 'dc:creator') || defaultAuthor,
    })
    if (items.length >= 10) break
  }
  return items.filter(i => i.title || i.link)
}

function extractLinkFromBlock(block: string): string {
  const content = extractTag(block, 'link')
  if (content) return content
  const hrefMatch = block.match(/<link[^>]+href="([^"]+)"/)
  if (hrefMatch) return hrefMatch[1]
  return extractTag(block, 'guid')
}

export function extractTag(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = xml.match(
    new RegExp(
      `<${escaped}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${escaped}>|<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`
    )
  )
  return (m?.[1] ?? m?.[2] ?? '').trim()
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole
  })
}

export function stripHtml(html: string): string {
  // Strip tags FIRST, then decode. Decoding first would turn `&lt;b&gt;` into a
  // real tag; decoding after the strip (as this used to) left `&lt;script&gt;`
  // as literal `<script>` text and never handled numeric entities at all.
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}
