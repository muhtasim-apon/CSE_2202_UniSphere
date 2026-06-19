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

router = APIRouter(prefix="/api/achievements", tags=["achievements"])

MAX_FILE_BYTES = 52_428_800  # 50 MB


# ── AUTH ──────────────────────────────────────────────────────────────────────

async def _auth(authorization: Optional[str]) -> object:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    res = _supabase.auth.get_user(authorization.split(" ", 1)[1])
    if not res.user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return res.user


def _user_id(user) -> str:
    """Return the Supabase auth UUID for a user object."""
    return user.id


# ── HELPERS ───────────────────────────────────────────────────────────────────

def _detect_file_type(mime: str, ext: str) -> str:
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("video/"):
        return "video"
    if mime.startswith("audio/"):
        return "audio"
    if "presentation" in mime or ext in ("pptx", "ppt", "odp", "key"):
        return "presentation"
    if mime in ("application/pdf",) or "word" in mime or "excel" in mime or ext in ("pdf", "doc", "docx", "xls", "xlsx", "odt", "csv"):
        return "document"
    if mime == "text/html" or ext in ("html", "htm"):
        return "site"
    return "other"


def _enrich_list(items: list, achievement_type: str, id_field: str) -> list:
    """Attach skills, reactions, rating, comment count, author name, and media to each item."""
    if not items:
        return items
    ids = [item[id_field] for item in items]

    skills_map: dict = {}
    reactions_map: dict = {}
    avg_map: dict = {}
    comment_count_map: dict = {}
    author_map: dict = {}
    media_map: dict = {}

    try:
        skill_table = {"project": "project_skill", "certificate": "certificate_skill", "research_paper": "research_paper_keyword", "hackathon": "hackathon_skill"}[achievement_type]
        skill_id_col = {"project": "project_id", "certificate": "certificate_id", "research_paper": "paper_id", "hackathon": "hackathon_id"}[achievement_type]
        skills_res = _supabase.table(skill_table).select(f"{skill_id_col}, skill_id, skill:skill(skill_name, category)").in_(skill_id_col, ids).execute()
        for row in (skills_res.data or []):
            key = row[skill_id_col]
            skills_map.setdefault(key, []).append(row.get("skill") or {})
    except Exception:
        pass

    try:
        reactions_res = _supabase.table("achievement_reaction").select("target_id, emoji").eq("achievement_type", achievement_type).in_("target_id", ids).execute()
        for row in (reactions_res.data or []):
            tid = row["target_id"]
            emoji = row["emoji"]
            reactions_map.setdefault(tid, {})
            reactions_map[tid][emoji] = reactions_map[tid].get(emoji, 0) + 1
    except Exception:
        pass

    try:
        ratings_res = _supabase.table("achievement_rating").select("target_id, rating").eq("achievement_type", achievement_type).in_("target_id", ids).execute()
        ratings_map: dict = {}
        for row in (ratings_res.data or []):
            tid = row["target_id"]
            ratings_map.setdefault(tid, []).append(row["rating"])
        avg_map = {tid: round(sum(rs) / len(rs), 1) for tid, rs in ratings_map.items()}
    except Exception:
        pass

    try:
        comments_res = _supabase.table("achievement_comment").select("target_id").eq("achievement_type", achievement_type).in_("target_id", ids).execute()
        for row in (comments_res.data or []):
            tid = row["target_id"]
            comment_count_map[tid] = comment_count_map.get(tid, 0) + 1
    except Exception:
        pass

    try:
        user_ids = list({item["user_id"] for item in items if item.get("user_id")})
        if user_ids:
            profiles_res = _supabase.table("profiles").select("id, first_name, last_name, avatar_url").in_("id", user_ids).execute()
            for row in (profiles_res.data or []):
                name = f"{row.get('first_name') or ''} {row.get('last_name') or ''}".strip()
                author_map[row["id"]] = {"name": name or "Unknown", "avatar": row.get("avatar_url") or None}
    except Exception:
        pass

    try:
        media_table = {"project": "project_media", "certificate": "certificate_media", "research_paper": "research_paper_media", "hackathon": "hackathon_media"}[achievement_type]
        media_id_col = {"project": "project_id", "certificate": "certificate_id", "research_paper": "paper_id", "hackathon": "hackathon_id"}[achievement_type]
        media_res = _supabase.table(media_table).select(f"media_id, {media_id_col}, file_url, file_type, file_name").in_(media_id_col, ids).execute()
        for row in (media_res.data or []):
            key = row[media_id_col]
            media_map.setdefault(key, []).append({
                "media_id": row.get("media_id"),
                "file_url": row.get("file_url"),
                "file_type": row.get("file_type"),
                "file_name": row.get("file_name"),
            })
    except Exception:
        pass

    for item in items:
        tid = item[id_field]
        item["skills"] = skills_map.get(tid, [])
        item["reactions"] = reactions_map.get(tid, {})
        item["avg_rating"] = avg_map.get(tid)
        item["comment_count"] = comment_count_map.get(tid, 0)
        author_info = author_map.get(item.get("user_id", ""), {})
        item["author_name"] = author_info.get("name", "Unknown") if isinstance(author_info, dict) else author_info
        item["author_avatar_url"] = author_info.get("avatar") if isinstance(author_info, dict) else None
        item["media"] = media_map.get(tid, [])

    return items


def _broadcast_achievement(
    owner_id: str,
    notif_type: str,
    title: str,
    body_text: str,
    achievement_type: str,
    target_id: int,
) -> None:
    """Insert a notification row for every user except the owner so the realtime
    listener on each client fires and they see the new achievement immediately."""
    try:
        profiles_res = _supabase.table("profiles").select("id").neq("id", owner_id).execute()
        if not profiles_res.data:
            return
        rows = [
            {
                "recipient_id": p["id"],
                "sender_id": owner_id,
                "notif_type": notif_type,
                "title": title,
                "body": body_text,
                "achievement_type": achievement_type,
                "target_id": target_id,
                "is_read": False,
            }
            for p in profiles_res.data
        ]
        if rows:
            _supabase.table("notification").insert(rows).execute()
    except Exception:
        pass


def _creator_name(user_id: str) -> str:
    res = _supabase.table("profiles").select("first_name, last_name").eq("id", user_id).maybe_single().execute()
    if res and res.data:
        return f"{res.data.get('first_name', '')} {res.data.get('last_name', '')}".strip() or "Someone"
    return "Someone"


def _find_skill_id_by_name(name: str) -> Optional[int]:
    key = name.lower()
    res = (
        _supabase.table("skill")
        .select("skill_id, skill_name")
        .ilike("skill_name", name)
        .limit(10)
        .execute()
    )
    for row in res.data or []:
        if row["skill_name"].lower() == key:
            return row["skill_id"]
    return None


def _get_or_create_skill_id(name: str) -> int:
    name = name.strip()[:100]
    if not name:
        raise HTTPException(status_code=400, detail="Skill name is required")

    existing_id = _find_skill_id_by_name(name)
    if existing_id is not None:
        return existing_id

    try:
        inserted = _supabase.table("skill").insert({"skill_name": name}).execute()
        if inserted.data:
            return inserted.data[0]["skill_id"]
    except Exception as exc:
        existing_id = _find_skill_id_by_name(name)
        if existing_id is not None:
            return existing_id
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save skill '{name}': {exc}. Run Database/skill_table_ensure.sql in Supabase SQL editor.",
        )

    try:
        upserted = (
            _supabase.table("skill")
            .upsert({"skill_name": name}, on_conflict="skill_name")
            .execute()
        )
        if upserted.data:
            return upserted.data[0]["skill_id"]
    except Exception:
        pass

    existing_id = _find_skill_id_by_name(name)
    if existing_id is not None:
        return existing_id

    raise HTTPException(
        status_code=500,
        detail=f"Failed to save skill '{name}'. Run Database/skill_table_ensure.sql in Supabase SQL editor.",
    )


def _resolve_skill_ids(skill_names: list[str]) -> list[int]:
    ids: list[int] = []
    seen: set[str] = set()
    for raw in skill_names:
        name = raw.strip()
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        ids.append(_get_or_create_skill_id(name))
    return ids


def _skill_ids_from_body(skill_ids: list[int], skill_names: list[str]) -> list[int]:
    if skill_names:
        return _resolve_skill_ids(skill_names)
    return skill_ids


async def _upload_media(file: UploadFile, achievement_type: str, owner_user_id: str) -> dict:
    content = await file.read()
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB limit")
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "bin"
    mime = file.content_type or "application/octet-stream"
    path = f"{achievement_type}/{owner_user_id}/{_uuid.uuid4()}.{ext}"
    _supabase.storage.from_("achievement-media").upload(path, content, {"content-type": mime})
    url = _supabase.storage.from_("achievement-media").get_public_url(path)
    return {
        "file_url": url,
        "file_name": file.filename or path,
        "file_type": _detect_file_type(mime, ext),
        "file_size_bytes": len(content),
        "mime_type": mime,
    }


# ── PYDANTIC MODELS ──────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)
    github_url: Optional[str] = None
    live_demo_url: Optional[str] = None
    start_month: Optional[int] = Field(default=None, ge=1, le=12)
    start_year: Optional[int] = Field(default=None, ge=2000, le=2100)
    end_month: Optional[int] = Field(default=None, ge=1, le=12)
    end_year: Optional[int] = Field(default=None, ge=2000, le=2100)
    is_current: bool = False
    associated_with: Optional[str] = Field(default=None, max_length=200)
    is_published: bool = True
    skill_ids: list[int] = []
    skill_names: list[str] = []
    contributor_user_ids: list[str] = []


class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=2000)
    github_url: Optional[str] = None
    live_demo_url: Optional[str] = None
    start_month: Optional[int] = Field(default=None, ge=1, le=12)
    start_year: Optional[int] = Field(default=None, ge=2000, le=2100)
    end_month: Optional[int] = Field(default=None, ge=1, le=12)
    end_year: Optional[int] = Field(default=None, ge=2000, le=2100)
    is_current: Optional[bool] = None
    associated_with: Optional[str] = None
    is_published: Optional[bool] = None


class CertificateCreate(BaseModel):
    cert_name: str = Field(min_length=1, max_length=255)
    issuing_org: str = Field(min_length=1, max_length=255)
    issue_month: Optional[int] = Field(default=None, ge=1, le=12)
    issue_year: int = Field(ge=2000, le=2100)
    expiry_month: Optional[int] = Field(default=None, ge=1, le=12)
    expiry_year: Optional[int] = Field(default=None, ge=2000, le=2100)
    credential_id: Optional[str] = None
    credential_url: Optional[str] = None
    is_published: bool = True
    skill_ids: list[int] = []
    skill_names: list[str] = []


class CertificateUpdate(BaseModel):
    cert_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    issuing_org: Optional[str] = None
    issue_month: Optional[int] = Field(default=None, ge=1, le=12)
    issue_year: Optional[int] = Field(default=None, ge=2000, le=2100)
    expiry_month: Optional[int] = Field(default=None, ge=1, le=12)
    expiry_year: Optional[int] = None
    credential_id: Optional[str] = None
    credential_url: Optional[str] = None
    is_published: Optional[bool] = None


class PaperCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    abstract: Optional[str] = None
    journal_name: Optional[str] = Field(default=None, max_length=300)
    conference_name: Optional[str] = Field(default=None, max_length=300)
    doi: Optional[str] = Field(default=None, max_length=255)
    paper_url: Optional[str] = None
    scholar_url: Optional[str] = None
    publish_month: Optional[int] = Field(default=None, ge=1, le=12)
    publish_year: Optional[int] = Field(default=None, ge=2000, le=2100)
    is_published: bool = True
    skill_ids: list[int] = []
    skill_names: list[str] = []
    authors: list[dict] = []


class PaperUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    abstract: Optional[str] = None
    journal_name: Optional[str] = None
    conference_name: Optional[str] = None
    doi: Optional[str] = None
    paper_url: Optional[str] = None
    scholar_url: Optional[str] = None
    publish_month: Optional[int] = Field(default=None, ge=1, le=12)
    publish_year: Optional[int] = Field(default=None, ge=2000, le=2100)
    is_published: Optional[bool] = None


class ReactRequest(BaseModel):
    achievement_type: Literal["project", "certificate", "research_paper", "hackathon"]
    target_id: int
    emoji: Literal["👍", "❤️", "🔥", "🎉", "🤩", "💡", "👏", "😮", "🏆", "💪"]


class CommentRequest(BaseModel):
    achievement_type: Literal["project", "certificate", "research_paper", "hackathon"]
    target_id: int
    body: str = Field(min_length=1, max_length=1000)
    parent_comment_id: Optional[int] = None


class RateRequest(BaseModel):
    achievement_type: Literal["project", "certificate", "research_paper", "hackathon"]
    target_id: int
    rating: int = Field(ge=1, le=5)


class HackathonCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    organizer: Optional[str] = Field(default=None, max_length=255)
    position: Optional[str] = Field(default=None, max_length=100)
    team_name: Optional[str] = Field(default=None, max_length=255)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None
    prize: Optional[str] = Field(default=None, max_length=255)
    event_url: Optional[str] = None
    is_published: bool = True
    skill_ids: list[int] = []


class HackathonUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    organizer: Optional[str] = None
    position: Optional[str] = None
    team_name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None
    prize: Optional[str] = None
    event_url: Optional[str] = None
    is_published: Optional[bool] = None


class SkillCreate(BaseModel):
    skill_name: str = Field(min_length=1, max_length=100)
    category: Optional[str] = Field(default=None, max_length=50)


# ── PROJECT ENDPOINTS ─────────────────────────────────────────────────────────

@router.post("/projects", status_code=201)
async def create_project(
    body: ProjectCreate,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    db_user_id = _user_id(user)

    row = _supabase.table("project").insert({
        "user_id": db_user_id,
        "title": body.title,
        "description": body.description,
        "github_url": body.github_url,
        "live_demo_url": body.live_demo_url,
        "start_month": body.start_month,
        "start_year": body.start_year,
        "end_month": body.end_month,
        "end_year": body.end_year,
        "is_current": body.is_current,
        "associated_with": body.associated_with,
        "is_published": body.is_published,
    }).execute().data[0]

    project_id = row["project_id"]

    skill_ids = _skill_ids_from_body(body.skill_ids, body.skill_names)
    if skill_ids:
        _supabase.table("project_skill").insert(
            [{"project_id": project_id, "skill_id": sid} for sid in skill_ids]
        ).execute()

    if body.contributor_user_ids:
        _supabase.table("project_contributor").insert(
            [{"project_id": project_id, "user_id": uid} for uid in body.contributor_user_ids]
        ).execute()

    if body.is_published:
        name = _creator_name(db_user_id)
        _broadcast_achievement(
            owner_id=db_user_id,
            notif_type="new_project",
            title=f"{name} shared a new project",
            body_text=body.title,
            achievement_type="project",
            target_id=project_id,
        )

    return row


@router.get("/projects")
async def list_projects(
    user_id: Optional[str] = None,
    page: int = 1,
    limit: int = 12,
    authorization: Optional[str] = Header(default=None),
):
    await _auth(authorization)
    query = _supabase.table("project").select("*").eq("is_published", True)
    if user_id:
        query = query.eq("user_id", user_id)
    offset = (page - 1) * limit
    res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"projects": _enrich_list(res.data or [], "project", "project_id"), "page": page, "limit": limit}


@router.get("/projects/{project_id}")
async def get_project(project_id: int, authorization: Optional[str] = Header(default=None)):
    await _auth(authorization)
    project = _supabase.table("project").select("*").eq("project_id", project_id).maybe_single().execute()
    if not project or not project.data:
        raise HTTPException(status_code=404, detail="Project not found")

    skills_res = _supabase.table("project_skill").select("skill_id, skill:skill(skill_name, category)").eq("project_id", project_id).execute()
    contributors_res = _supabase.table("project_contributor").select("*").eq("project_id", project_id).execute()
    media_res = _supabase.table("project_media").select("*").eq("project_id", project_id).execute()
    reactions_res = _supabase.table("achievement_reaction").select("user_id, emoji, reacted_at").eq("achievement_type", "project").eq("target_id", project_id).execute()
    comments_res = _supabase.table("achievement_comment").select("*").eq("achievement_type", "project").eq("target_id", project_id).order("created_at").execute()
    ratings_res = _supabase.table("achievement_rating").select("rating").eq("achievement_type", "project").eq("target_id", project_id).execute()

    reaction_counts: dict = {}
    for r in (reactions_res.data or []):
        reaction_counts[r["emoji"]] = reaction_counts.get(r["emoji"], 0) + 1

    ratings = [r["rating"] for r in (ratings_res.data or [])]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else None

    return {
        **project.data,
        "skills": [row.get("skill") or {} for row in (skills_res.data or [])],
        "contributors": contributors_res.data or [],
        "media": media_res.data or [],
        "reactions": reactions_res.data or [],
        "reaction_counts": reaction_counts,
        "comments": comments_res.data or [],
        "avg_rating": avg_rating,
        "rating_count": len(ratings),
    }


@router.put("/projects/{project_id}")
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    existing = _supabase.table("project").select("user_id").eq("project_id", project_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Project not found")
    if existing.data["user_id"] != db_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    res = _supabase.table("project").update(update_data).eq("project_id", project_id).execute()
    return res.data[0]


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: int, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    existing = _supabase.table("project").select("user_id").eq("project_id", project_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Project not found")
    if existing.data["user_id"] != db_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    _supabase.table("project").delete().eq("project_id", project_id).execute()


@router.post("/projects/{project_id}/media", status_code=201)
async def upload_project_media(
    project_id: int,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    existing = _supabase.table("project").select("user_id").eq("project_id", project_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Project not found")
    if existing.data["user_id"] != db_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    media = await _upload_media(file, "project", db_user_id)
    res = _supabase.table("project_media").insert({"project_id": project_id, **media}).execute()
    return res.data[0]


@router.delete("/projects/{project_id}/media/{media_id}", status_code=204)
async def delete_project_media(
    project_id: int,
    media_id: int,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    existing = _supabase.table("project").select("user_id").eq("project_id", project_id).maybe_single().execute()
    if not existing or not existing.data or existing.data["user_id"] != db_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    _supabase.table("project_media").delete().eq("media_id", media_id).eq("project_id", project_id).execute()


# ── CERTIFICATE ENDPOINTS ─────────────────────────────────────────────────────

@router.post("/certificates", status_code=201)
async def create_certificate(body: CertificateCreate, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    row = _supabase.table("certificate").insert({
        "user_id": db_user_id,
        "cert_name": body.cert_name,
        "issuing_org": body.issuing_org,
        "issue_month": body.issue_month,
        "issue_year": body.issue_year,
        "expiry_month": body.expiry_month,
        "expiry_year": body.expiry_year,
        "credential_id": body.credential_id,
        "credential_url": body.credential_url,
        "is_published": body.is_published,
    }).execute().data[0]
    cert_id = row["certificate_id"]
    skill_ids = _skill_ids_from_body(body.skill_ids, body.skill_names)
    if skill_ids:
        _supabase.table("certificate_skill").insert(
            [{"certificate_id": cert_id, "skill_id": sid} for sid in skill_ids]
        ).execute()

    if body.is_published:
        name = _creator_name(db_user_id)
        _broadcast_achievement(
            owner_id=db_user_id,
            notif_type="new_certificate",
            title=f"{name} earned a certificate",
            body_text=body.cert_name,
            achievement_type="certificate",
            target_id=cert_id,
        )

    return row


@router.get("/certificates")
async def list_certificates(
    user_id: Optional[str] = None,
    page: int = 1,
    limit: int = 12,
    authorization: Optional[str] = Header(default=None),
):
    await _auth(authorization)
    query = _supabase.table("certificate").select("*").eq("is_published", True)
    if user_id:
        query = query.eq("user_id", user_id)
    offset = (page - 1) * limit
    res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"certificates": _enrich_list(res.data or [], "certificate", "certificate_id"), "page": page, "limit": limit}


@router.get("/certificates/{certificate_id}")
async def get_certificate(certificate_id: int, authorization: Optional[str] = Header(default=None)):
    await _auth(authorization)
    cert = _supabase.table("certificate").select("*").eq("certificate_id", certificate_id).maybe_single().execute()
    if not cert or not cert.data:
        raise HTTPException(status_code=404, detail="Certificate not found")
    skills_res = _supabase.table("certificate_skill").select("skill_id, skill:skill(skill_name, category)").eq("certificate_id", certificate_id).execute()
    media_res = _supabase.table("certificate_media").select("*").eq("certificate_id", certificate_id).execute()
    reactions_res = _supabase.table("achievement_reaction").select("user_id, emoji").eq("achievement_type", "certificate").eq("target_id", certificate_id).execute()
    comments_res = _supabase.table("achievement_comment").select("*").eq("achievement_type", "certificate").eq("target_id", certificate_id).order("created_at").execute()
    ratings_res = _supabase.table("achievement_rating").select("rating").eq("achievement_type", "certificate").eq("target_id", certificate_id).execute()
    reaction_counts: dict = {}
    for r in (reactions_res.data or []):
        reaction_counts[r["emoji"]] = reaction_counts.get(r["emoji"], 0) + 1
    ratings = [r["rating"] for r in (ratings_res.data or [])]
    return {
        **cert.data,
        "skills": [row.get("skill") or {} for row in (skills_res.data or [])],
        "media": media_res.data or [],
        "reactions": reactions_res.data or [],
        "reaction_counts": reaction_counts,
        "comments": comments_res.data or [],
        "avg_rating": round(sum(ratings) / len(ratings), 1) if ratings else None,
        "rating_count": len(ratings),
    }


@router.put("/certificates/{certificate_id}")
async def update_certificate(
    certificate_id: int,
    body: CertificateUpdate,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    existing = _supabase.table("certificate").select("user_id").eq("certificate_id", certificate_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Not found")
    if existing.data["user_id"] != db_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    res = _supabase.table("certificate").update(update_data).eq("certificate_id", certificate_id).execute()
    return res.data[0]


@router.delete("/certificates/{certificate_id}", status_code=204)
async def delete_certificate(certificate_id: int, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    existing = _supabase.table("certificate").select("user_id").eq("certificate_id", certificate_id).maybe_single().execute()
    if not existing or not existing.data or existing.data["user_id"] != db_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    _supabase.table("certificate").delete().eq("certificate_id", certificate_id).execute()


@router.post("/certificates/{certificate_id}/media", status_code=201)
async def upload_certificate_media(
    certificate_id: int,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    existing = _supabase.table("certificate").select("user_id").eq("certificate_id", certificate_id).maybe_single().execute()
    if not existing or not existing.data or existing.data["user_id"] != db_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    media = await _upload_media(file, "certificate", db_user_id)
    res = _supabase.table("certificate_media").insert({"certificate_id": certificate_id, **media}).execute()
    return res.data[0]


# ── RESEARCH PAPER ENDPOINTS ──────────────────────────────────────────────────

@router.post("/papers", status_code=201)
async def create_paper(body: PaperCreate, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    row = _supabase.table("research_paper").insert({
        "user_id": db_user_id,
        "title": body.title,
        "abstract": body.abstract,
        "journal_name": body.journal_name,
        "conference_name": body.conference_name,
        "doi": body.doi,
        "paper_url": body.paper_url,
        "scholar_url": body.scholar_url,
        "publish_month": body.publish_month,
        "publish_year": body.publish_year,
        "is_published": body.is_published,
    }).execute().data[0]

    paper_id = row["paper_id"]

    skill_ids = _skill_ids_from_body(body.skill_ids, body.skill_names)
    if skill_ids:
        _supabase.table("research_paper_keyword").insert(
            [{"paper_id": paper_id, "skill_id": sid} for sid in skill_ids]
        ).execute()

    if body.authors:
        author_rows = [
            {
                "paper_id": paper_id,
                "author_name": a.get("author_name", ""),
                "author_order": a.get("author_order", i + 1),
                "is_corresponding": a.get("is_corresponding", False),
                "user_id": a.get("user_id"),
            }
            for i, a in enumerate(body.authors)
        ]
        _supabase.table("research_paper_author").insert(author_rows).execute()

    if body.is_published:
        name = _creator_name(db_user_id)
        _broadcast_achievement(
            owner_id=db_user_id,
            notif_type="new_research_paper",
            title=f"{name} published a research paper",
            body_text=body.title,
            achievement_type="research_paper",
            target_id=paper_id,
        )

    return row


@router.get("/papers")
async def list_papers(
    user_id: Optional[str] = None,
    page: int = 1,
    limit: int = 12,
    authorization: Optional[str] = Header(default=None),
):
    await _auth(authorization)
    query = _supabase.table("research_paper").select("*").eq("is_published", True)
    if user_id:
        query = query.eq("user_id", user_id)
    offset = (page - 1) * limit
    res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"papers": _enrich_list(res.data or [], "research_paper", "paper_id"), "page": page, "limit": limit}


@router.get("/papers/{paper_id}")
async def get_paper(paper_id: int, authorization: Optional[str] = Header(default=None)):
    await _auth(authorization)
    paper = _supabase.table("research_paper").select("*").eq("paper_id", paper_id).maybe_single().execute()
    if not paper or not paper.data:
        raise HTTPException(status_code=404, detail="Paper not found")
    keywords_res = _supabase.table("research_paper_keyword").select("skill_id, skill:skill(skill_name, category)").eq("paper_id", paper_id).execute()
    authors_res = _supabase.table("research_paper_author").select("*").eq("paper_id", paper_id).order("author_order").execute()
    media_res = _supabase.table("research_paper_media").select("*").eq("paper_id", paper_id).execute()
    reactions_res = _supabase.table("achievement_reaction").select("user_id, emoji").eq("achievement_type", "research_paper").eq("target_id", paper_id).execute()
    comments_res = _supabase.table("achievement_comment").select("*").eq("achievement_type", "research_paper").eq("target_id", paper_id).order("created_at").execute()
    ratings_res = _supabase.table("achievement_rating").select("rating").eq("achievement_type", "research_paper").eq("target_id", paper_id).execute()
    reaction_counts: dict = {}
    for r in (reactions_res.data or []):
        reaction_counts[r["emoji"]] = reaction_counts.get(r["emoji"], 0) + 1
    ratings = [r["rating"] for r in (ratings_res.data or [])]
    return {
        **paper.data,
        "keywords": [row.get("skill") or {} for row in (keywords_res.data or [])],
        "authors": authors_res.data or [],
        "media": media_res.data or [],
        "reactions": reactions_res.data or [],
        "reaction_counts": reaction_counts,
        "comments": comments_res.data or [],
        "avg_rating": round(sum(ratings) / len(ratings), 1) if ratings else None,
        "rating_count": len(ratings),
    }


@router.put("/papers/{paper_id}")
async def update_paper(
    paper_id: int,
    body: PaperUpdate,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    existing = _supabase.table("research_paper").select("user_id").eq("paper_id", paper_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Not found")
    if existing.data["user_id"] != db_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    res = _supabase.table("research_paper").update(update_data).eq("paper_id", paper_id).execute()
    return res.data[0]


@router.delete("/papers/{paper_id}", status_code=204)
async def delete_paper(paper_id: int, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    existing = _supabase.table("research_paper").select("user_id").eq("paper_id", paper_id).maybe_single().execute()
    if not existing or not existing.data or existing.data["user_id"] != db_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    _supabase.table("research_paper").delete().eq("paper_id", paper_id).execute()


@router.post("/papers/{paper_id}/media", status_code=201)
async def upload_paper_media(
    paper_id: int,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    existing = _supabase.table("research_paper").select("user_id").eq("paper_id", paper_id).maybe_single().execute()
    if not existing or not existing.data or existing.data["user_id"] != db_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    media = await _upload_media(file, "research_paper", db_user_id)
    res = _supabase.table("research_paper_media").insert({"paper_id": paper_id, **media}).execute()
    return res.data[0]


# ── SOCIAL ENDPOINTS ──────────────────────────────────────────────────────────

@router.post("/react")
async def toggle_reaction(body: ReactRequest, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    db_user_id = _user_id(user)

    existing = _supabase.table("achievement_reaction").select("reaction_id").eq("user_id", db_user_id).eq("achievement_type", body.achievement_type).eq("target_id", body.target_id).eq("emoji", body.emoji).maybe_single().execute()

    if existing and existing.data:
        _supabase.table("achievement_reaction").delete().eq("reaction_id", existing.data["reaction_id"]).execute()
        reacted = False
    else:
        _supabase.table("achievement_reaction").insert({
            "user_id": db_user_id,
            "achievement_type": body.achievement_type,
            "target_id": body.target_id,
            "emoji": body.emoji,
        }).execute()
        reacted = True

    total = _supabase.table("achievement_reaction").select("reaction_id", count="exact").eq("achievement_type", body.achievement_type).eq("target_id", body.target_id).eq("emoji", body.emoji).execute()
    return {"reacted": reacted, "emoji": body.emoji, "total_for_emoji": total.count or 0}


@router.post("/comment", status_code=201)
async def create_comment(body: CommentRequest, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    db_user_id = _user_id(user)

    row = _supabase.table("achievement_comment").insert({
        "user_id": db_user_id,
        "achievement_type": body.achievement_type,
        "target_id": body.target_id,
        "body": body.body,
        "parent_comment_id": body.parent_comment_id,
    }).execute().data[0]

    # Look up content owner to send notification
    owner_id_col = {"project": ("project", "user_id", "project_id"), "certificate": ("certificate", "user_id", "certificate_id"), "research_paper": ("research_paper", "user_id", "paper_id"), "hackathon": ("hackathon", "user_id", "hackathon_id")}[body.achievement_type]
    owner_res = _supabase.table(owner_id_col[0]).select(owner_id_col[1]).eq(owner_id_col[2], body.target_id).maybe_single().execute()
    if owner_res and owner_res.data:
        owner_id = owner_res.data[owner_id_col[1]]
        if owner_id != db_user_id:
            commenter_name_res = _supabase.table("profiles").select("first_name, last_name").eq("id", db_user_id).maybe_single().execute()
            _pdata = commenter_name_res.data or {}
            commenter_name = ((_pdata.get("first_name") or "") + " " + (_pdata.get("last_name") or "")).strip() or "Someone"
            _supabase.table("notification").insert({
                "recipient_id": owner_id,
                "sender_id": db_user_id,
                "notif_type": "new_comment",
                "title": f"{commenter_name} commented on your {body.achievement_type.replace('_', ' ')}",
                "body": body.body[:200],
                "achievement_type": body.achievement_type,
                "target_id": body.target_id,
            }).execute()

    return row


@router.delete("/comment/{comment_id}", status_code=204)
async def delete_comment(comment_id: int, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    existing = _supabase.table("achievement_comment").select("user_id").eq("comment_id", comment_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Comment not found")
    if existing.data["user_id"] != db_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    _supabase.table("achievement_comment").delete().eq("comment_id", comment_id).execute()


@router.post("/rate")
async def upsert_rating(body: RateRequest, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    _supabase.table("achievement_rating").upsert({
        "user_id": db_user_id,
        "achievement_type": body.achievement_type,
        "target_id": body.target_id,
        "rating": body.rating,
    }, on_conflict="user_id,achievement_type,target_id").execute()
    ratings = _supabase.table("achievement_rating").select("rating").eq("achievement_type", body.achievement_type).eq("target_id", body.target_id).execute()
    values = [r["rating"] for r in (ratings.data or [])]
    return {
        "your_rating": body.rating,
        "avg_rating": round(sum(values) / len(values), 1) if values else body.rating,
        "rating_count": len(values),
    }


@router.get("/comments")
async def list_comments(
    achievement_type: str,
    target_id: int,
    page: int = 1,
    authorization: Optional[str] = Header(default=None),
):
    await _auth(authorization)
    limit = 20
    offset = (page - 1) * limit
    res = _supabase.table("achievement_comment").select("*").eq("achievement_type", achievement_type).eq("target_id", target_id).order("created_at").range(offset, offset + limit - 1).execute()
    comments = res.data or []
    # Enrich with author profile info
    user_ids = list({c["user_id"] for c in comments if c.get("user_id")})
    profile_map: dict = {}
    if user_ids:
        try:
            pr = _supabase.table("profiles").select("id, first_name, last_name, avatar_url").in_("id", user_ids).execute()
            for row in (pr.data or []):
                name = f"{row.get('first_name') or ''} {row.get('last_name') or ''}".strip()
                profile_map[row["id"]] = {"name": name or "User", "avatar": row.get("avatar_url") or None}
        except Exception:
            pass
    for c in comments:
        info = profile_map.get(c.get("user_id", ""), {})
        c["author_name"] = info.get("name", "User")
        c["author_avatar"] = info.get("avatar")
    return {"comments": comments, "page": page}


# ── SKILLS ENDPOINTS ──────────────────────────────────────────────────────────

@router.post("/skills", status_code=201)
async def create_skill(body: SkillCreate, authorization: Optional[str] = Header(default=None)):
    await _auth(authorization)
    skill_id = _get_or_create_skill_id(body.skill_name)
    res = (
        _supabase.table("skill")
        .select("skill_id, skill_name, category")
        .eq("skill_id", skill_id)
        .single()
        .execute()
    )
    return res.data


# ── NOTIFICATION ENDPOINTS ────────────────────────────────────────────────────

@router.get("/notifications")
async def list_notifications(
    page: int = 1,
    limit: int = 20,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    offset = (page - 1) * limit
    res = _supabase.table("notification").select("*").eq("recipient_id", db_user_id).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"notifications": res.data or [], "page": page, "limit": limit}


@router.patch("/notifications/read-all")
async def mark_all_notifications_read(authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    _supabase.table("notification").update({"is_read": True}).eq("recipient_id", db_user_id).eq("is_read", False).execute()
    return {"ok": True}


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: int, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    existing = _supabase.table("notification").select("recipient_id").eq("notification_id", notification_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Not found")
    if existing.data["recipient_id"] != db_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    res = _supabase.table("notification").update({"is_read": True}).eq("notification_id", notification_id).execute()
    return res.data[0]


# ── HACKATHON ENDPOINTS ───────────────────────────────────────────────────────

@router.post("/hackathons", status_code=201)
async def create_hackathon(body: HackathonCreate, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    row = _supabase.table("hackathon").insert({
        "user_id": db_user_id,
        "title": body.title,
        "organizer": body.organizer,
        "position": body.position,
        "team_name": body.team_name,
        "start_date": body.start_date,
        "end_date": body.end_date,
        "description": body.description,
        "prize": body.prize,
        "event_url": body.event_url,
        "is_published": body.is_published,
    }).execute().data[0]

    hackathon_id = row["hackathon_id"]

    if body.skill_ids:
        _supabase.table("hackathon_skill").insert(
            [{"hackathon_id": hackathon_id, "skill_id": sid} for sid in body.skill_ids]
        ).execute()

    if body.is_published:
        name = _creator_name(db_user_id)
        _broadcast_achievement(
            owner_id=db_user_id,
            notif_type="general",
            title=f"{name} participated in a hackathon",
            body_text=body.title,
            achievement_type="hackathon",
            target_id=hackathon_id,
        )

    return row


@router.get("/hackathons")
async def list_hackathons(
    user_id: Optional[str] = None,
    page: int = 1,
    limit: int = 12,
    authorization: Optional[str] = Header(default=None),
):
    await _auth(authorization)
    query = _supabase.table("hackathon").select("*").eq("is_published", True)
    if user_id:
        query = query.eq("user_id", user_id)
    offset = (page - 1) * limit
    res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"hackathons": _enrich_list(res.data or [], "hackathon", "hackathon_id"), "page": page, "limit": limit}


@router.get("/hackathons/{hackathon_id}")
async def get_hackathon(hackathon_id: int, authorization: Optional[str] = Header(default=None)):
    await _auth(authorization)
    h = _supabase.table("hackathon").select("*").eq("hackathon_id", hackathon_id).maybe_single().execute()
    if not h or not h.data:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    skills_res = _supabase.table("hackathon_skill").select("skill_id, skill:skill(skill_name, category)").eq("hackathon_id", hackathon_id).execute()
    media_res = _supabase.table("hackathon_media").select("*").eq("hackathon_id", hackathon_id).execute()
    reactions_res = _supabase.table("achievement_reaction").select("user_id, emoji").eq("achievement_type", "hackathon").eq("target_id", hackathon_id).execute()
    comments_res = _supabase.table("achievement_comment").select("*").eq("achievement_type", "hackathon").eq("target_id", hackathon_id).order("created_at").execute()
    ratings_res = _supabase.table("achievement_rating").select("rating").eq("achievement_type", "hackathon").eq("target_id", hackathon_id).execute()
    reaction_counts: dict = {}
    for r in (reactions_res.data or []):
        reaction_counts[r["emoji"]] = reaction_counts.get(r["emoji"], 0) + 1
    ratings = [r["rating"] for r in (ratings_res.data or [])]
    return {
        **h.data,
        "skills": [row.get("skill") or {} for row in (skills_res.data or [])],
        "media": media_res.data or [],
        "reactions": reactions_res.data or [],
        "reaction_counts": reaction_counts,
        "comments": comments_res.data or [],
        "avg_rating": round(sum(ratings) / len(ratings), 1) if ratings else None,
        "rating_count": len(ratings),
    }


@router.put("/hackathons/{hackathon_id}")
async def update_hackathon(
    hackathon_id: int,
    body: HackathonUpdate,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    existing = _supabase.table("hackathon").select("user_id").eq("hackathon_id", hackathon_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if existing.data["user_id"] != db_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    res = _supabase.table("hackathon").update(update_data).eq("hackathon_id", hackathon_id).execute()
    return res.data[0]


@router.delete("/hackathons/{hackathon_id}", status_code=204)
async def delete_hackathon(hackathon_id: int, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    existing = _supabase.table("hackathon").select("user_id").eq("hackathon_id", hackathon_id).maybe_single().execute()
    if not existing or not existing.data or existing.data["user_id"] != db_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    _supabase.table("hackathon").delete().eq("hackathon_id", hackathon_id).execute()


class AdvisorUpdateRequest(BaseModel):
    advisor_name: Optional[str] = Field(default=None, max_length=120)
    advisor_user_id: Optional[int] = None


@router.patch("/projects/{project_id}/advisor")
async def update_project_advisor(
    project_id: int,
    body: AdvisorUpdateRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    existing = _supabase.table("project").select("user_id").eq("project_id", project_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Project not found")
    if existing.data["user_id"] != db_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    update_data: dict = {}
    if body.advisor_name is not None:
        update_data["advisor_name"] = body.advisor_name or None
    if body.advisor_user_id is not None:
        update_data["advisor_user_id"] = body.advisor_user_id
    elif "advisor_user_id" in body.model_fields_set:
        update_data["advisor_user_id"] = None
    res = _supabase.table("project").update(update_data).eq("project_id", project_id).execute()
    return res.data[0]


@router.post("/hackathons/{hackathon_id}/media", status_code=201)
async def upload_hackathon_media(
    hackathon_id: int,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    db_user_id = _user_id(user)
    existing = _supabase.table("hackathon").select("user_id").eq("hackathon_id", hackathon_id).maybe_single().execute()
    if not existing or not existing.data or existing.data["user_id"] != db_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    media = await _upload_media(file, "hackathon", db_user_id)
    res = _supabase.table("hackathon_media").insert({"hackathon_id": hackathon_id, **media}).execute()
    return res.data[0]
