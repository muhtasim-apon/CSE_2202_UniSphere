const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export type NoticePost = {
  id: string
  author_id: string
  author_name: string
  author_avatar: string | null
  author_role: string
  category: string
  audience: string
  title: string
  content: string
  is_edited: boolean
  edited_at: string | null
  has_poll: boolean
  created_at: string
  updated_at: string
  attachment_count: number
  reaction_count: number
}

export type Attachment = {
  id: string
  post_id: string
  file_url: string
  file_name: string
  file_type: string
  file_size: number | null
  mime_type: string | null
  created_at: string
}

/** Aggregate tallies plus the caller's own choice. The server deliberately does
 *  not return per-user rows — that leaked every user's reaction to everyone. */
export type ReactionSummary = {
  counts: Record<string, number>
  my_reaction: string | null
  total: number
}

export type PollData = {
  poll: {
    id: string
    post_id: string
    question: string
    is_multiple: boolean
    ends_at: string | null
    created_at: string
  }
  options: {
    id: string
    poll_id: string
    option_text: string
    display_order: number
    created_at: string
  }[]
  vote_counts: Record<string, number>
  my_votes: string[]
}

type NoticeCreateData = {
  title: string
  content: string
  category: string
  audience: string
}

type PollCreateData = {
  question: string
  options: string[]
  is_multiple: boolean
  ends_at?: string
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function apiFetch(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res
}

export async function getNotices(token: string, category?: string, page = 1): Promise<{ notices: NoticePost[] }> {
  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (category) params.set('category', category)
  const res = await apiFetch(`${BASE}/api/notices?${params}`, {
    headers: authHeader(token),
  })
  return res.json()
}

export async function createNotice(data: NoticeCreateData, token: string): Promise<NoticePost> {
  const res = await apiFetch(`${BASE}/api/notices`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function updateNotice(id: string, data: Partial<NoticeCreateData>, token: string): Promise<NoticePost> {
  const res = await apiFetch(`${BASE}/api/notices/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function deleteNotice(id: string, token: string): Promise<void> {
  await apiFetch(`${BASE}/api/notices/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function getReactions(noticeId: string, token: string): Promise<ReactionSummary> {
  const res = await apiFetch(`${BASE}/api/notices/${noticeId}/reactions`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function upsertReaction(noticeId: string, reaction: string, token: string): Promise<void> {
  await apiFetch(`${BASE}/api/notices/${noticeId}/reactions`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ reaction }),
  })
}

export async function removeReaction(noticeId: string, token: string): Promise<void> {
  await apiFetch(`${BASE}/api/notices/${noticeId}/reactions`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function getPoll(noticeId: string, token: string): Promise<PollData> {
  const res = await apiFetch(`${BASE}/api/notices/${noticeId}/poll`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function createPoll(noticeId: string, data: PollCreateData, token: string): Promise<{ poll_id: string }> {
  const res = await apiFetch(`${BASE}/api/notices/${noticeId}/poll`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function castVote(noticeId: string, optionId: string, token: string): Promise<void> {
  await apiFetch(`${BASE}/api/notices/${noticeId}/poll/vote`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ option_id: optionId }),
  })
}

export async function getAttachments(noticeId: string, token: string): Promise<Attachment[]> {
  const res = await apiFetch(`${BASE}/api/notices/${noticeId}/attachments`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function uploadAttachment(noticeId: string, file: File, token: string): Promise<Attachment> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/api/notices/${noticeId}/attachments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Upload failed ${res.status}: ${text}`)
  }
  return res.json()
}
