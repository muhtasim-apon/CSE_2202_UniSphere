export interface RssItem {
  title: string
  link: string
  description: string
  pubDate: string
  author: string
}

export function parseRssXml(xml: string, defaultAuthor: string): RssItem[] {
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  const items: RssItem[] = []
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    items.push({
      title: extractTag(block, 'title'),
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

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
