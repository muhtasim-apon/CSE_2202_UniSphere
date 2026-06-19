import os
import uuid as _uuid
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, File, HTTPException, Header, UploadFile
from pydantic import BaseModel, Field
from supabase import create_client

load_dotenv()

_supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

router = APIRouter(prefix="/api/chat", tags=["chat"])

REACTION_TYPES = Literal[
    "like", "love", "haha", "wow", "sad", "angry", "fire", "clap", "think", "party"
]


# ── AUTH ──────────────────────────────────────────────────────────────────────

async def _auth(authorization: Optional[str]) -> object:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    res = _supabase.auth.get_user(authorization.split(" ", 1)[1])
    if not res.user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return res.user


def _assert_member(room_id: str, user_id: str):
    row = (
        _supabase.table("chat_room_member")
        .select("profile_id")
        .eq("room_id", room_id)
        .eq("profile_id", user_id)
        .maybe_single()
        .execute()
    )
    if not row or not row.data:
        raise HTTPException(status_code=403, detail="Not a member of this room")


# ── MIME → attachment_file_type ───────────────────────────────────────────────

def _detect_file_type(mime: str, ext: str) -> str:
    if mime.startswith("image/"):
        return "image"
    if mime == "application/pdf":
        return "pdf"
    if "word" in mime or ext in ("doc", "docx"):
        return "doc"
    if "text/markdown" in mime or ext == "md":
        return "markdown"
    if mime == "video/mp4" or ext == "mp4":
        return "mp4"
    if mime.startswith("audio/") or ext in ("mp3", "m4a", "ogg", "webm"):
        return "audio"
    return "other"


# ── REQUEST MODELS ─────────────────────────────────────────────────────────────

class DirectRoomRequest(BaseModel):
    other_profile_id: str

class GroupRoomRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    member_emails: list[str] = Field(default=[])
    password: Optional[str] = None

class JoinRoomRequest(BaseModel):
    room_code: str = Field(min_length=1)
    password: Optional[str] = None

class ChatRequestBody(BaseModel):
    to_id: str

class SendMessageRequest(BaseModel):
    body: Optional[str] = None
    reply_to: Optional[str] = None
    has_attachment: bool = False

class EditMessageRequest(BaseModel):
    body: str = Field(min_length=1)

class ReactionRequest(BaseModel):
    reaction: REACTION_TYPES


# ── PEOPLE & REQUESTS ────────────────────────────────────────────────────────

@router.get("/people")
async def list_people(
    search: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    """Return all profiles except the caller's, with their request status."""
    user = await _auth(authorization)

    query = _supabase.table("profiles").select("id, display_name, avatar_url, role")
    if search:
        query = query.ilike("display_name", f"%{search}%")
    people_res = query.neq("id", user.id).limit(50).execute()
    people = people_res.data or []

    if not people:
        return []

    ids = [p["id"] for p in people]

    # Fetch any requests between caller and these profiles
    requests_res = (
        _supabase.table("chat_request")
        .select("id, from_id, to_id, status")
        .or_(f"from_id.eq.{user.id},to_id.eq.{user.id}")
        .execute()
    )
    req_map: dict = {}
    for r in (requests_res.data or []):
        other = r["to_id"] if r["from_id"] == user.id else r["from_id"]
        if other in ids or other == user.id:
            req_map[other] = r

    # Fetch existing direct rooms between caller and these users
    member_res = (
        _supabase.table("chat_room_member")
        .select("room_id, profile_id")
        .in_("profile_id", ids)
        .execute()
    )
    # Build set of profile_ids already in a direct room with me
    my_rooms_res = (
        _supabase.table("chat_room_member")
        .select("room_id")
        .eq("profile_id", user.id)
        .execute()
    )
    my_room_ids = {r["room_id"] for r in (my_rooms_res.data or [])}
    rooms_res = (
        _supabase.table("chat_room")
        .select("id")
        .in_("id", list(my_room_ids))
        .eq("type", "direct")
        .execute()
    ) if my_room_ids else None
    direct_room_ids = {r["id"] for r in (rooms_res.data or [])} if rooms_res else set()

    their_room_profile_ids: set = set()
    for m in (member_res.data or []):
        if m["room_id"] in direct_room_ids:
            their_room_profile_ids.add(m["profile_id"])

    result = []
    for p in people:
        pid = p["id"]
        req = req_map.get(pid)
        result.append({
            **p,
            "request_id": req["id"] if req else None,
            "request_status": req["status"] if req else None,
            "request_direction": (
                "outgoing" if req and req["from_id"] == user.id
                else "incoming" if req
                else None
            ),
            "has_direct_room": pid in their_room_profile_ids,
        })

    return result


@router.post("/requests", status_code=201)
async def send_request(
    body: ChatRequestBody,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    if body.to_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot send request to yourself")

    existing = (
        _supabase.table("chat_request")
        .select("id, status")
        .eq("from_id", user.id)
        .eq("to_id", body.to_id)
        .maybe_single()
        .execute()
    )
    if existing and existing.data:
        raise HTTPException(status_code=409, detail="Request already sent")

    res = _supabase.table("chat_request").insert({
        "from_id": user.id,
        "to_id": body.to_id,
        "status": "pending",
    }).execute()
    return res.data[0]


@router.get("/requests")
async def list_requests(authorization: Optional[str] = Header(default=None)):
    """Return incoming pending requests for the caller."""
    user = await _auth(authorization)
    res = (
        _supabase.table("chat_request")
        .select("id, from_id, to_id, status, created_at, sender:profiles!from_id(display_name, avatar_url)")
        .eq("to_id", user.id)
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.post("/requests/{request_id}/accept")
async def accept_request(
    request_id: str,
    authorization: Optional[str] = Header(default=None),
):
    from datetime import datetime, timezone
    user = await _auth(authorization)

    req = (
        _supabase.table("chat_request")
        .select("id, from_id, to_id, status")
        .eq("id", request_id)
        .single()
        .execute()
    )
    if not req.data:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.data["to_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if req.data["status"] != "pending":
        raise HTTPException(status_code=409, detail="Request already resolved")

    # Create (or fetch) the direct room first — pass caller's profile_id explicitly
    # because service-role bypasses auth.uid()
    room_res = _supabase.rpc(
        "fn_get_or_create_direct_room",
        {"p_other_profile_id": req.data["from_id"], "p_my_profile_id": user.id},
    ).execute()
    room_id = room_res.data

    # Only mark accepted after room is successfully created
    _supabase.table("chat_request").update({
        "status": "accepted",
        "responded_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", request_id).execute()

    room = _supabase.table("chat_room").select("*").eq("id", room_id).single().execute()
    return {"room": room.data, "request_id": request_id}


@router.post("/requests/{request_id}/decline", status_code=204)
async def decline_request(
    request_id: str,
    authorization: Optional[str] = Header(default=None),
):
    from datetime import datetime, timezone
    user = await _auth(authorization)

    req = (
        _supabase.table("chat_request")
        .select("id, to_id, status")
        .eq("id", request_id)
        .single()
        .execute()
    )
    if not req.data or req.data["to_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    _supabase.table("chat_request").update({
        "status": "declined",
        "responded_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", request_id).execute()


@router.delete("/requests/{request_id}", status_code=204)
async def withdraw_request(
    request_id: str,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    req = (
        _supabase.table("chat_request")
        .select("id, from_id")
        .eq("id", request_id)
        .single()
        .execute()
    )
    if not req.data or req.data["from_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    _supabase.table("chat_request").delete().eq("id", request_id).execute()


# ── ROOMS ─────────────────────────────────────────────────────────────────────

@router.get("/rooms")
async def list_rooms(authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)

    memberships = (
        _supabase.table("chat_room_member")
        .select("room_id, last_read_at, member_role")
        .eq("profile_id", user.id)
        .execute()
    )

    if not memberships.data:
        return []

    room_ids = [m["room_id"] for m in memberships.data]
    rooms = (
        _supabase.table("chat_room")
        .select("*")
        .in_("id", room_ids)
        .execute()
    )

    membership_map = {m["room_id"]: m for m in memberships.data}

    # For direct rooms, fetch the other member's profile to use as title/avatar
    direct_room_ids = [r["id"] for r in (rooms.data or []) if r["type"] == "direct"]
    other_member_map: dict = {}
    if direct_room_ids:
        other_members_res = (
            _supabase.table("chat_room_member")
            .select("room_id, profile_id, profile:profiles(display_name, avatar_url)")
            .in_("room_id", direct_room_ids)
            .neq("profile_id", user.id)
            .execute()
        )
        for m in (other_members_res.data or []):
            other_member_map[m["room_id"]] = m.get("profile") or {}

    result = []
    for room in (rooms.data or []):
        rid = room["id"]
        last_msg_res = (
            _supabase.table("chat_message")
            .select("id, body, sender_id, created_at, attachments:chat_message_attachment(file_type, mime_type)")
            .eq("room_id", rid)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        last_msg = None
        if last_msg_res.data:
            m = last_msg_res.data[0]
            att = (m.get("attachments") or [None])[0]
            att_type = None
            if att:
                ft = att.get("file_type", "")
                mime = att.get("mime_type", "") or ""
                if ft == "image": att_type = "image"
                elif ft == "mp4" or mime.startswith("video/"): att_type = "video"
                elif ft == "audio" or mime.startswith("audio/"):
                    att_type = "voicenote" if "webm" in mime or "ogg" in mime else "audio"
                else: att_type = "file"
            last_msg = {
                "id": m["id"],
                "body": m["body"],
                "sender_id": m["sender_id"],
                "created_at": m["created_at"],
                "attachment_type": att_type,
            }

        last_read = membership_map[rid].get("last_read_at")
        unread = 0
        if last_read:
            unread_res = (
                _supabase.table("chat_message")
                .select("id", count="exact")
                .eq("room_id", rid)
                .gt("created_at", last_read)
                .neq("sender_id", user.id)
                .execute()
            )
            unread = unread_res.count or 0

        # For direct rooms, use the other person's name and avatar
        other = other_member_map.get(rid, {})
        enriched = {
            **room,
            "member_role": membership_map[rid]["member_role"],
            "last_read_at": last_read,
            "last_message": last_msg,
            "unread_count": unread,
        }
        if room["type"] == "direct" and other:
            enriched["title"] = other.get("display_name") or "Unknown"
            enriched["other_avatar_url"] = other.get("avatar_url")

        result.append(enriched)

    return result


@router.post("/rooms/direct", status_code=201)
async def open_direct_room(
    body: DirectRoomRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    res = _supabase.rpc(
        "fn_get_or_create_direct_room",
        {"p_other_profile_id": body.other_profile_id, "p_my_profile_id": user.id},
    ).execute()
    room_id = res.data
    room = _supabase.table("chat_room").select("*").eq("id", room_id).single().execute()
    return room.data


@router.get("/rooms/advisor")
async def get_advisor_room(authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)

    # Resolve student row
    student = (
        _supabase.table("student")
        .select("student_id")
        .eq("profile_id", user.id)
        .maybe_single()
        .execute()
    )
    if not student or not student.data:
        raise HTTPException(status_code=404, detail="Student profile not found")

    advisor = (
        _supabase.table("advisor")
        .select("advisor_instructor_id")
        .eq("student_id", student.data["student_id"])
        .maybe_single()
        .execute()
    )
    if not advisor or not advisor.data:
        raise HTTPException(status_code=404, detail="No advisor assigned")

    instructor = (
        _supabase.table("instructor")
        .select("profile_id")
        .eq("instructor_id", advisor.data["advisor_instructor_id"])
        .single()
        .execute()
    )
    advisor_profile_id = instructor.data["profile_id"]

    # Get or create the advisor room (direct type is fine for 1:1 advisor)
    res = _supabase.rpc(
        "fn_get_or_create_direct_room",
        {"p_other_profile_id": advisor_profile_id},
    ).execute()
    room_id = res.data

    # Tag it as advisor type if it was just created
    _supabase.table("chat_room").update({"type": "advisor"}).eq("id", room_id).eq("type", "direct").execute()

    room = _supabase.table("chat_room").select("*").eq("id", room_id).single().execute()
    advisor_profile = (
        _supabase.table("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", advisor_profile_id)
        .single()
        .execute()
    )
    return {**room.data, "advisor_profile": advisor_profile.data}


@router.post("/rooms/group", status_code=201)
async def create_group_room(
    body: GroupRoomRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    import secrets

    password_hash = None
    if body.password:
        hash_res = _supabase.rpc("fn_hash_password", {"p_password": body.password}).execute()
        password_hash = hash_res.data

    room_code = secrets.token_urlsafe(8)
    room_res = (
        _supabase.table("chat_room")
        .insert({
            "type": "group",
            "title": body.title,
            "room_code": room_code,
            "password_hash": password_hash,
            "is_ephemeral": True,
            "created_by": user.id,
        })
        .execute()
    )
    room = room_res.data[0]
    room_id = room["id"]

    # Resolve emails → profile IDs
    resolved_ids: list[str] = []
    not_found: list[str] = []
    for email in body.member_emails:
        try:
            res = _supabase.rpc("fn_profile_id_by_email", {"p_email": email.strip().lower()}).execute()
            pid = res.data
            if pid and pid != user.id:
                resolved_ids.append(pid)
            elif not pid:
                not_found.append(email)
        except Exception:
            not_found.append(email)

    members = [{"room_id": room_id, "profile_id": user.id, "member_role": "owner"}]
    for pid in resolved_ids:
        members.append({"room_id": room_id, "profile_id": pid, "member_role": "member"})
    _supabase.table("chat_room_member").insert(members).execute()

    return {**room, "room_code": room_code, "not_found_emails": not_found}


@router.post("/rooms/join")
async def join_room(
    body: JoinRoomRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    res = _supabase.rpc(
        "fn_join_room_by_code",
        {"p_code": body.room_code, "p_password": body.password or None},
    ).execute()
    room_id = res.data
    room = _supabase.table("chat_room").select("*").eq("id", room_id).single().execute()
    return room.data


@router.delete("/rooms/{room_id}", status_code=204)
async def delete_or_leave_room(
    room_id: str,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    _assert_member(room_id, user.id)

    room = _supabase.table("chat_room").select("type, created_by").eq("id", room_id).single().execute()
    if not room.data:
        raise HTTPException(status_code=404, detail="Room not found")

    rtype = room.data["type"]
    created_by = room.data["created_by"]

    if rtype == "direct":
        # Delete the whole room (messages cascade via FK)
        _supabase.table("chat_room").delete().eq("id", room_id).execute()
    elif rtype == "group":
        if created_by == user.id:
            # Owner deletes the entire group
            _supabase.table("chat_room").delete().eq("id", room_id).execute()
        else:
            # Non-owner just leaves
            _supabase.table("chat_room_member").delete().eq("room_id", room_id).eq("profile_id", user.id).execute()
    else:
        # Advisor — just leave
        _supabase.table("chat_room_member").delete().eq("room_id", room_id).eq("profile_id", user.id).execute()


@router.get("/rooms/{room_id}")
async def get_room(
    room_id: str,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    _assert_member(room_id, user.id)

    room = _supabase.table("chat_room").select("*").eq("id", room_id).single().execute()
    if not room.data:
        raise HTTPException(status_code=404, detail="Room not found")

    members_res = (
        _supabase.table("chat_room_member")
        .select("profile_id, member_role, joined_at, profiles(display_name, avatar_url)")
        .eq("room_id", room_id)
        .execute()
    )
    return {**room.data, "members": members_res.data}


# ── MESSAGES ──────────────────────────────────────────────────────────────────

@router.get("/rooms/{room_id}/messages")
async def get_messages(
    room_id: str,
    before: Optional[str] = None,
    limit: int = 30,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    _assert_member(room_id, user.id)

    query = (
        _supabase.table("chat_message")
        .select(
            "*, sender:profiles(display_name, avatar_url), "
            "attachments:chat_message_attachment(*), "
            "reactions:chat_message_reaction(id, user_id, reaction)"
        )
        .eq("room_id", room_id)
        .order("created_at", desc=True)
        .limit(min(limit, 100))
    )
    if before:
        query = query.lt("created_at", before)

    res = query.execute()
    return res.data


@router.post("/rooms/{room_id}/messages", status_code=201)
async def send_message(
    room_id: str,
    body: SendMessageRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    _assert_member(room_id, user.id)

    if not body.body and not body.reply_to and not body.has_attachment:
        raise HTTPException(status_code=400, detail="Message must have body, reply, or attachment")

    data: dict = {"room_id": room_id, "sender_id": user.id}
    if body.body:
        data["body"] = body.body
    if body.reply_to:
        data["reply_to"] = body.reply_to

    res = _supabase.table("chat_message").insert(data).execute()
    return res.data[0]


@router.patch("/messages/{message_id}")
async def edit_message(
    message_id: str,
    body: EditMessageRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    msg = (
        _supabase.table("chat_message")
        .select("sender_id, room_id")
        .eq("id", message_id)
        .single()
        .execute()
    )
    if not msg.data:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.data["sender_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    from datetime import datetime, timezone
    res = (
        _supabase.table("chat_message")
        .update({"body": body.body, "edited_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", message_id)
        .execute()
    )
    return res.data[0]


@router.delete("/messages/{message_id}", status_code=204)
async def delete_message(
    message_id: str,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    msg = (
        _supabase.table("chat_message")
        .select("sender_id")
        .eq("id", message_id)
        .single()
        .execute()
    )
    if not msg.data:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.data["sender_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    _supabase.table("chat_message").delete().eq("id", message_id).execute()


# ── ATTACHMENTS ───────────────────────────────────────────────────────────────

@router.post("/messages/{message_id}/attachments", status_code=201)
async def upload_attachment(
    message_id: str,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    msg = (
        _supabase.table("chat_message")
        .select("sender_id, room_id")
        .eq("id", message_id)
        .single()
        .execute()
    )
    if not msg.data:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.data["sender_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "bin"
    storage_path = f"{message_id}/{_uuid.uuid4()}.{ext}"
    content = await file.read()
    _supabase.storage.from_("chat-attachments").upload(
        storage_path, content, {"content-type": file.content_type}
    )
    file_url = _supabase.storage.from_("chat-attachments").get_public_url(storage_path)

    mime = file.content_type or ""
    ftype = _detect_file_type(mime, ext)

    res = _supabase.table("chat_message_attachment").insert({
        "message_id": message_id,
        "file_url": file_url,
        "file_name": file.filename or storage_path,
        "file_type": ftype,
        "file_size": len(content),
        "mime_type": mime,
    }).execute()
    return res.data[0]


# ── REACTIONS ─────────────────────────────────────────────────────────────────

@router.post("/messages/{message_id}/reactions", status_code=201)
async def add_reaction(
    message_id: str,
    body: ReactionRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    msg = (
        _supabase.table("chat_message")
        .select("room_id")
        .eq("id", message_id)
        .single()
        .execute()
    )
    if not msg.data:
        raise HTTPException(status_code=404, detail="Message not found")
    _assert_member(msg.data["room_id"], user.id)

    res = _supabase.table("chat_message_reaction").upsert({
        "message_id": message_id,
        "user_id": user.id,
        "reaction": body.reaction,
    }, on_conflict="message_id,user_id,reaction").execute()
    return res.data[0]


@router.delete("/messages/{message_id}/reactions", status_code=204)
async def remove_reaction(
    message_id: str,
    body: ReactionRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    _supabase.table("chat_message_reaction").delete().eq("message_id", message_id).eq("user_id", user.id).eq("reaction", body.reaction).execute()


# ── MARK READ ─────────────────────────────────────────────────────────────────

@router.post("/rooms/{room_id}/read", status_code=204)
async def mark_read(
    room_id: str,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    _assert_member(room_id, user.id)

    from datetime import datetime, timezone
    _supabase.table("chat_room_member").update(
        {"last_read_at": datetime.now(timezone.utc).isoformat()}
    ).eq("room_id", room_id).eq("profile_id", user.id).execute()


# ── ADMIN / MAINTENANCE ───────────────────────────────────────────────────────

@router.post("/admin/purge-ephemeral", status_code=204)
async def purge_ephemeral(authorization: Optional[str] = Header(default=None)):
    """Fallback for environments without pg_cron. Call from an external scheduler."""
    user = await _auth(authorization)
    profile = _supabase.table("profiles").select("role").eq("id", user.id).single().execute()
    if not profile.data or profile.data.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    ephemeral_rooms = (
        _supabase.table("chat_room")
        .select("id")
        .eq("is_ephemeral", True)
        .execute()
    )
    if ephemeral_rooms.data:
        room_ids = [r["id"] for r in ephemeral_rooms.data]
        _supabase.table("chat_message").delete().in_("room_id", room_ids).lt("created_at", cutoff).execute()
