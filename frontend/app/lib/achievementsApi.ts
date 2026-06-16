import { API_BASE } from '@/app/lib/apiBase'

const BASE = API_BASE

// ── Types ──────────────────────────────────────────────────────────────────

export type Skill = {
  skill_id: number
  skill_name: string
  category: string | null
}

export type MediaItem = {
  media_id: number
  file_url: string
  file_type: string
  file_name: string
}

export type Project = {
  project_id: number
  user_id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  github_url: string | null
  live_demo_url: string | null
  start_month: number | null
  start_year: number | null
  end_month: number | null
  end_year: number | null
  is_current: boolean
  associated_with: string | null
  is_published: boolean
  created_at: string
  updated_at: string
  // enriched fields
  skills?: Skill[]
  reactions?: Record<string, number>
  avg_rating?: number | null
  comment_count?: number
  author_name?: string
  media?: MediaItem[]
}

export type Certificate = {
  certificate_id: number
  user_id: string
  cert_name: string
  issuing_org: string
  issue_month: number | null
  issue_year: number
  expiry_month: number | null
  expiry_year: number | null
  credential_id: string | null
  credential_url: string | null
  is_published: boolean
  created_at: string
  updated_at: string
  skills?: Skill[]
  reactions?: Record<string, number>
  avg_rating?: number | null
  comment_count?: number
  author_name?: string
  media?: MediaItem[]
}

export type ResearchPaper = {
  paper_id: number
  user_id: string
  title: string
  abstract: string | null
  journal_name: string | null
  conference_name: string | null
  doi: string | null
  paper_url: string | null
  scholar_url: string | null
  publish_month: number | null
  publish_year: number | null
  citation_count: number
  is_published: boolean
  created_at: string
  updated_at: string
  keywords?: Skill[]
  reactions?: Record<string, number>
  avg_rating?: number | null
  comment_count?: number
  author_name?: string
  media?: MediaItem[]
}

export type Hackathon = {
  hackathon_id: number
  user_id: string
  title: string
  organizer: string | null
  position: string | null
  team_name: string | null
  start_date: string | null
  end_date: string | null
  description: string | null
  prize: string | null
  event_url: string | null
  is_published: boolean
  created_at: string
  updated_at: string
  skills?: Skill[]
  reactions?: Record<string, number>
  avg_rating?: number | null
  comment_count?: number
  author_name?: string
  media?: MediaItem[]
}

export type AchievementReaction = {
  reaction_id: number
  user_id: string
  achievement_type: 'project' | 'certificate' | 'research_paper'
  target_id: number
  emoji: string
  reacted_at: string
}

export type AchievementComment = {
  comment_id: number
  user_id: string
  achievement_type: 'project' | 'certificate' | 'research_paper'
  target_id: number
  parent_comment_id: number | null
  body: string
  created_at: string
  updated_at: string
}

export type AchievementRating = {
  rating_id: number
  user_id: string
  achievement_type: 'project' | 'certificate' | 'research_paper'
  target_id: number
  rating: number
  rated_at: string
}

export type AchievementNotification = {
  notification_id: number
  recipient_id: string
  sender_id: string | null
  notif_type: string
  title: string
  body: string | null
  achievement_type: string | null
  target_id: number | null
  is_read: boolean
  created_at: string
}

export type MediaRecord = {
  media_id: number
  file_url: string
  file_name: string
  file_type: string
  file_size_bytes: number
  mime_type: string | null
  uploaded_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function apiFetch(url: string, init: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new Error('Backend is not running. Start it: cd backend && .\\venv\\Scripts\\activate && uvicorn main:app --reload --port 8000')
  }
  if (!res.ok) {
    let detail = ''
    try {
      const json = await res.json()
      detail = json?.detail ?? JSON.stringify(json)
    } catch {
      detail = await res.text().catch(() => '')
    }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return res
}

// ── Projects ───────────────────────────────────────────────────────────────

export async function getProjects(token: string, userId?: string, page = 1): Promise<{ projects: Project[] }> {
  const params = new URLSearchParams({ page: String(page), limit: '12' })
  if (userId) params.set('user_id', String(userId))
  const res = await apiFetch(`${BASE}/api/achievements/projects?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function getProject(token: string, projectId: number): Promise<Project> {
  const res = await apiFetch(`${BASE}/api/achievements/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function createProject(token: string, data: Partial<Project> & { skill_ids?: number[]; skill_names?: string[]; contributor_user_ids?: number[] }): Promise<Project> {
  const res = await apiFetch(`${BASE}/api/achievements/projects`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function updateProject(token: string, projectId: number, data: Partial<Project>): Promise<Project> {
  const res = await apiFetch(`${BASE}/api/achievements/projects/${projectId}`, {
    method: 'PUT',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function deleteProject(token: string, projectId: number): Promise<void> {
  await apiFetch(`${BASE}/api/achievements/projects/${projectId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function uploadProjectMedia(token: string, projectId: number, file: File): Promise<MediaRecord> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/api/achievements/projects/${projectId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Upload failed ${res.status}`)
  return res.json()
}

export async function deleteProjectMedia(token: string, projectId: number, mediaId: number): Promise<void> {
  await apiFetch(`${BASE}/api/achievements/projects/${projectId}/media/${mediaId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// ── Certificates ────────────────────────────────────────────────────────────

export async function getCertificates(token: string, userId?: string, page = 1): Promise<{ certificates: Certificate[] }> {
  const params = new URLSearchParams({ page: String(page), limit: '12' })
  if (userId) params.set('user_id', String(userId))
  const res = await apiFetch(`${BASE}/api/achievements/certificates?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function createCertificate(token: string, data: Partial<Certificate> & { skill_ids?: number[]; skill_names?: string[] }): Promise<Certificate> {
  const res = await apiFetch(`${BASE}/api/achievements/certificates`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function updateCertificate(token: string, certId: number, data: Partial<Certificate>): Promise<Certificate> {
  const res = await apiFetch(`${BASE}/api/achievements/certificates/${certId}`, {
    method: 'PUT',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function deleteCertificate(token: string, certId: number): Promise<void> {
  await apiFetch(`${BASE}/api/achievements/certificates/${certId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function uploadCertificateMedia(token: string, certId: number, file: File): Promise<MediaRecord> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/api/achievements/certificates/${certId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Upload failed ${res.status}`)
  return res.json()
}

// ── Research Papers ──────────────────────────────────────────────────────────

export async function getPapers(token: string, userId?: string, page = 1): Promise<{ papers: ResearchPaper[] }> {
  const params = new URLSearchParams({ page: String(page), limit: '12' })
  if (userId) params.set('user_id', String(userId))
  const res = await apiFetch(`${BASE}/api/achievements/papers?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function createPaper(token: string, data: Partial<ResearchPaper> & { skill_ids?: number[]; skill_names?: string[]; authors?: object[] }): Promise<ResearchPaper> {
  const res = await apiFetch(`${BASE}/api/achievements/papers`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function updatePaper(token: string, paperId: number, data: Partial<ResearchPaper>): Promise<ResearchPaper> {
  const res = await apiFetch(`${BASE}/api/achievements/papers/${paperId}`, {
    method: 'PUT',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function deletePaper(token: string, paperId: number): Promise<void> {
  await apiFetch(`${BASE}/api/achievements/papers/${paperId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function uploadPaperMedia(token: string, paperId: number, file: File): Promise<MediaRecord> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/api/achievements/papers/${paperId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Upload failed ${res.status}`)
  return res.json()
}

// ── Social ──────────────────────────────────────────────────────────────────

export async function toggleReaction(
  token: string,
  achievement_type: 'project' | 'certificate' | 'research_paper',
  target_id: number,
  emoji: string,
): Promise<{ reacted: boolean; emoji: string; total_for_emoji: number }> {
  const res = await apiFetch(`${BASE}/api/achievements/react`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ achievement_type, target_id, emoji }),
  })
  return res.json()
}

export async function postComment(
  token: string,
  achievement_type: 'project' | 'certificate' | 'research_paper',
  target_id: number,
  body: string,
  parent_comment_id?: number,
): Promise<AchievementComment> {
  const res = await apiFetch(`${BASE}/api/achievements/comment`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ achievement_type, target_id, body, parent_comment_id }),
  })
  return res.json()
}

export async function deleteComment(token: string, commentId: number): Promise<void> {
  await apiFetch(`${BASE}/api/achievements/comment/${commentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function rateAchievement(
  token: string,
  achievement_type: 'project' | 'certificate' | 'research_paper',
  target_id: number,
  rating: number,
): Promise<{ your_rating: number; avg_rating: number; rating_count: number }> {
  const res = await apiFetch(`${BASE}/api/achievements/rate`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ achievement_type, target_id, rating }),
  })
  return res.json()
}

export async function getComments(
  token: string,
  achievement_type: string,
  target_id: number,
  page = 1,
): Promise<{ comments: AchievementComment[] }> {
  const params = new URLSearchParams({ achievement_type, target_id: String(target_id), page: String(page) })
  const res = await apiFetch(`${BASE}/api/achievements/comments?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

// ── Notifications ───────────────────────────────────────────────────────────

export async function getAchievementNotifications(token: string, page = 1): Promise<{ notifications: AchievementNotification[] }> {
  const res = await apiFetch(`${BASE}/api/achievements/notifications?page=${page}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await apiFetch(`${BASE}/api/achievements/notifications/read-all`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function markNotificationRead(token: string, notificationId: number): Promise<void> {
  await apiFetch(`${BASE}/api/achievements/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// ── Hackathons ───────────────────────────────────────────────────────────────

export async function getHackathons(token: string, userId?: string, page = 1): Promise<{ hackathons: Hackathon[] }> {
  const params = new URLSearchParams({ page: String(page), limit: '12' })
  if (userId) params.set('user_id', userId)
  const res = await apiFetch(`${BASE}/api/achievements/hackathons?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function createHackathon(token: string, data: Partial<Hackathon> & { skill_ids?: number[] }): Promise<Hackathon> {
  const res = await apiFetch(`${BASE}/api/achievements/hackathons`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function updateHackathon(token: string, hackathonId: number, data: Partial<Hackathon>): Promise<Hackathon> {
  const res = await apiFetch(`${BASE}/api/achievements/hackathons/${hackathonId}`, {
    method: 'PUT',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function deleteHackathon(token: string, hackathonId: number): Promise<void> {
  await apiFetch(`${BASE}/api/achievements/hackathons/${hackathonId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function uploadHackathonMedia(token: string, hackathonId: number, file: File): Promise<MediaRecord> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/api/achievements/hackathons/${hackathonId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Upload failed ${res.status}`)
  return res.json()
}
