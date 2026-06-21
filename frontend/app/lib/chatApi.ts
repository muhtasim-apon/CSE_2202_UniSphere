const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Types ──────────────────────────────────────────────────────────────────

export type ChatRoomType = 'direct' | 'advisor' | 'group'

export type ChatRoom = {
  id: string
  type: ChatRoomType
  title: string | null
  room_code: string | null
  is_ephemeral: boolean
  created_by: string
  created_at: string
  member_role?: string
  last_read_at?: string | null
  last_message?: {
    id: string
    body: string | null
    sender_id: string
    created_at: string
    attachment_type?: 'image' | 'video' | 'voicenote' | 'audio' | 'file' | null
  } | null
  unread_count?: number
  other_avatar_url?: string | null
  avatar_url?: string | null
}

export type ChatMessage = {
  id: string
  room_id: string
  sender_id: string
  body: string | null
  reply_to: string | null
  created_at: string
  edited_at: string | null
  sender: { display_name: string | null; avatar_url: string | null } | null
  reply: { id: string; body: string | null; sender_id: string } | null  // resolved client-side
  attachments: ChatAttachment[]
  reactions: ChatReaction[]
}

export type ChatAttachment = {
  id: string
  message_id: string
  file_url: string
  file_name: string
  file_type: string
  file_size: number | null
  mime_type: string | null
}

export type ChatReaction = {
  id: string
  message_id: string
  user_id: string
  reaction: string
  created_at: string
}

export type ReactionType =
  | 'like' | 'love' | 'haha' | 'wow' | 'sad'
  | 'angry' | 'fire' | 'clap' | 'think' | 'party'

export type PersonEntry = {
  id: string
  display_name: string | null
  avatar_url: string | null
  role: string | null
  request_id: string | null
  request_status: 'pending' | 'accepted' | 'declined' | null
  request_direction: 'outgoing' | 'incoming' | null
  has_direct_room: boolean
}

export type ChatRequest = {
  id: string
  from_id: string
  to_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  room_id: string | null
  room_title: string | null
  sender: { display_name: string | null; avatar_url: string | null } | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

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

// ── Rooms ──────────────────────────────────────────────────────────────────

export async function getRooms(token: string): Promise<ChatRoom[]> {
  const res = await apiFetch(`${BASE}/api/chat/rooms`, { headers: authHeader(token) })
  return res.json()
}

export async function openDirectRoom(otherProfileId: string, token: string): Promise<ChatRoom> {
  const res = await apiFetch(`${BASE}/api/chat/rooms/direct`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ other_profile_id: otherProfileId }),
  })
  return res.json()
}

export async function openAdvisorRoom(token: string): Promise<ChatRoom & { advisor_profile: unknown }> {
  const res = await apiFetch(`${BASE}/api/chat/rooms/advisor`, { headers: authHeader(token) })
  return res.json()
}

export async function createGroupRoom(
  data: { title: string; member_emails: string[]; member_ids?: string[]; password?: string },
  token: string
): Promise<ChatRoom & { room_code: string; not_found_emails: string[] }> {
  const res = await apiFetch(`${BASE}/api/chat/rooms/group`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function joinRoom(
  data: { room_code: string; password?: string },
  token: string
): Promise<ChatRoom> {
  const res = await apiFetch(`${BASE}/api/chat/rooms/join`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function getRoom(roomId: string, token: string): Promise<ChatRoom & { members: unknown[] }> {
  const res = await apiFetch(`${BASE}/api/chat/rooms/${roomId}`, { headers: authHeader(token) })
  return res.json()
}

export async function deleteRoom(roomId: string, token: string): Promise<void> {
  await apiFetch(`${BASE}/api/chat/rooms/${roomId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export type RoomMember = {
  profile_id: string
  member_role: string
  nickname: string | null
  joined_at: string | null
  profiles: { display_name: string | null; avatar_url: string | null } | null
}

export type PendingInvite = {
  to_id: string
  created_at: string
  invitee: { display_name: string | null; avatar_url: string | null } | null
}

export async function getRoomMembers(roomId: string, token: string): Promise<{ members: RoomMember[]; pending_invites: PendingInvite[] }> {
  const res = await apiFetch(`${BASE}/api/chat/rooms/${roomId}`, { headers: authHeader(token) })
  const data = await res.json()
  return { members: data.members ?? [], pending_invites: data.pending_invites ?? [] }
}

export async function setMemberNickname(roomId: string, profileId: string, nickname: string | null, token: string): Promise<void> {
  await apiFetch(`${BASE}/api/chat/rooms/${roomId}/members/${profileId}/nickname`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ nickname }),
  })
}

export async function inviteMember(roomId: string, profileId: string, token: string): Promise<void> {
  await apiFetch(`${BASE}/api/chat/rooms/${roomId}/invite`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ profile_id: profileId }),
  })
}

export async function setGroupAvatar(roomId: string, file: File, token: string): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/api/chat/rooms/${roomId}/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Avatar upload failed: ${res.status}`)
  const data = await res.json()
  return data.avatar_url
}

export async function renameRoom(roomId: string, title: string, token: string): Promise<ChatRoom> {
  const res = await apiFetch(`${BASE}/api/chat/rooms/${roomId}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ title }),
  })
  return res.json()
}

// ── Messages ───────────────────────────────────────────────────────────────

export async function getMessages(
  roomId: string,
  token: string,
  before?: string,
  limit = 30
): Promise<ChatMessage[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (before) params.set('before', before)
  const res = await apiFetch(`${BASE}/api/chat/rooms/${roomId}/messages?${params}`, {
    headers: authHeader(token),
  })
  return res.json()
}

export async function sendMessage(
  roomId: string,
  data: { body?: string; reply_to?: string; has_attachment?: boolean },
  token: string
): Promise<ChatMessage> {
  const res = await apiFetch(`${BASE}/api/chat/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function editMessage(
  messageId: string,
  body: string,
  token: string
): Promise<ChatMessage> {
  const res = await apiFetch(`${BASE}/api/chat/messages/${messageId}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ body }),
  })
  return res.json()
}

export async function deleteMessage(messageId: string, token: string): Promise<void> {
  await apiFetch(`${BASE}/api/chat/messages/${messageId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// ── Attachments ────────────────────────────────────────────────────────────

export async function uploadChatAttachment(
  messageId: string,
  file: File,
  token: string
): Promise<ChatAttachment> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/api/chat/messages/${messageId}/attachments`, {
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

// ── Reactions ──────────────────────────────────────────────────────────────

export async function addReaction(
  messageId: string,
  reaction: ReactionType,
  token: string
): Promise<ChatReaction> {
  const res = await apiFetch(`${BASE}/api/chat/messages/${messageId}/reactions`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ reaction }),
  })
  return res.json()
}

export async function removeReaction(
  messageId: string,
  reaction: ReactionType,
  token: string
): Promise<void> {
  await apiFetch(`${BASE}/api/chat/messages/${messageId}/reactions`, {
    method: 'DELETE',
    headers: authHeader(token),
    body: JSON.stringify({ reaction }),
  })
}

// ── People & Requests ──────────────────────────────────────────────────────

export async function getPeople(token: string, search?: string): Promise<PersonEntry[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  const res = await apiFetch(`${BASE}/api/chat/people?${params}`, { headers: authHeader(token) })
  return res.json()
}

export async function sendChatRequest(toId: string, token: string): Promise<ChatRequest> {
  const res = await apiFetch(`${BASE}/api/chat/requests`, {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ to_id: toId }),
  })
  return res.json()
}

export async function getRequests(token: string): Promise<ChatRequest[]> {
  const res = await apiFetch(`${BASE}/api/chat/requests`, { headers: authHeader(token) })
  return res.json()
}

export async function acceptRequest(requestId: string, token: string): Promise<{ room: ChatRoom; request_id: string }> {
  const res = await apiFetch(`${BASE}/api/chat/requests/${requestId}/accept`, {
    method: 'POST',
    headers: authHeader(token),
  })
  return res.json()
}

export async function declineRequest(requestId: string, token: string): Promise<void> {
  await apiFetch(`${BASE}/api/chat/requests/${requestId}/decline`, {
    method: 'POST',
    headers: authHeader(token),
  })
}

export async function withdrawRequest(requestId: string, token: string): Promise<void> {
  await apiFetch(`${BASE}/api/chat/requests/${requestId}`, {
    method: 'DELETE',
    headers: authHeader(token),
  })
}

// ── Mark Read ──────────────────────────────────────────────────────────────

export async function markRead(roomId: string, token: string): Promise<void> {
  await apiFetch(`${BASE}/api/chat/rooms/${roomId}/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}
