import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import Literal, Optional

import truststore

# This machine's network path (antivirus/corporate TLS inspection) injects
# a root CA that only lives in the Windows cert store, and that CA's Basic
# Constraints aren't marked critical — OpenSSL 3's parser rejects it outright,
# breaking every outbound HTTPS call (httpx, urllib, ...). truststore routes
# TLS verification through the OS's own validator instead, which already
# trusts it.
truststore.inject_into_ssl()

import jwt as pyjwt
from jwt import PyJWKClient
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Header, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client

load_dotenv()

from routers.achievements import router as achievements_router  # noqa: E402
from routers.chat import router as chat_router  # noqa: E402
from routers.classes import router as classes_router, profile_router  # noqa: E402

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

SYMMETRIC_ALGS = ["HS256", "HS384", "HS512"]
ASYMMETRIC_ALGS = ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"]

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("unisphere")

@dataclass
class SimpleUser:
    id: str

# JWKS client is created once and caches the public keys in memory.
# Used when Supabase project uses RS256 / ES256 (asymmetric keys).
_jwks_client: Optional[PyJWKClient] = None

def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
    return _jwks_client
# Google OAuth — set in .env
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_REDIRECT_URI=http://localhost:3000/dashboard/classes

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


@asynccontextmanager
async def lifespan(app: FastAPI):
    for bucket, size in [
        ("notice-attachments", 52428800),
        ("achievement-media",  52428800),
        ("chat-attachments",   52428800),
        ("class-resources",    52428800),
    ]:
        try:
            supabase.storage.create_bucket(
                bucket,
                options={"public": True, "file_size_limit": size},
            )
        except Exception:
            pass  # bucket already exists
    yield


app = FastAPI(lifespan=lifespan)

app.include_router(achievements_router)
app.include_router(chat_router)
app.include_router(classes_router)
app.include_router(profile_router)

# `https://.*\.vercel\.app` would let ANY Vercel-hosted site call this API with
# the user's token. Pin to this project's own deployments (production plus its
# preview builds, which are prefixed `unisphere-`), and localhost for dev.
_EXTRA_ORIGINS = [o.strip() for o in os.environ.get("CORS_EXTRA_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://unisphere-beta.vercel.app", *_EXTRA_ORIGINS],
    allow_origin_regex=r"(http://(localhost|127\.0\.0\.1):\d+|https://unisphere[a-z0-9-]*\.vercel\.app)",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Fields rejected by the DB guard triggers for self-service updates
# (trg_student_profile_guard / trg_instructor_profile_guard in profile_feature.sql)
STUDENT_LOCKED_FIELDS = {
    "profile_id", "program_id", "student_roll",
    "batch_year", "current_semester", "cgpa", "total_credits", "is_active",
}
INSTRUCTOR_LOCKED_FIELDS = {
    "profile_id", "dept_id", "employee_id", "designation", "is_active",
}


class StudentOnboardingRequest(BaseModel):
    dept_name: str = Field(min_length=2, max_length=100)
    dept_code: str = Field(pattern=r"^[A-Z]{2,10}$")
    program_name: str = Field(min_length=3, max_length=150)
    program_code: str = Field(pattern=r"^[A-Z0-9-]{2,20}$")
    degree_level: Literal["Certificate", "Diploma", "Associate", "Bachelor", "Master", "PhD"]
    duration_years: float = Field(ge=0.5, le=8)
    total_credits: int = Field(ge=1, le=300)
    student_roll: str = Field(pattern=r"^[0-9]{4,20}$")
    batch_year: int = Field(ge=2000, le=2100)
    gender: Optional[Literal["Male", "Female", "Other"]] = None
    date_of_birth: str
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class InstructorOnboardingRequest(BaseModel):
    dept_name: str = Field(min_length=2, max_length=100)
    dept_code: str = Field(pattern=r"^[A-Z]{2,10}$")
    employee_id: str = Field(pattern=r"^EMP-[0-9]{3,6}$")
    designation: Literal[
        "Lecturer", "Assistant Professor", "Associate Professor", "Professor", "Adjunct", "Visiting"
    ]
    gender: Optional[Literal["Male", "Female", "Other"]] = None
    date_of_birth: Optional[str] = None
    phone: Optional[str] = None
    office_location: Optional[str] = None
    specialization: Optional[str] = None
    bio: Optional[str] = None


def _get_or_create_department(dept_name: str, dept_code: str):
    existing = (
        supabase.table("department").select("*").eq("dept_code", dept_code).maybe_single().execute()
    )
    if existing and existing.data:
        return existing.data

    created = (
        supabase.table("department")
        .insert({"dept_name": dept_name, "dept_code": dept_code})
        .execute()
    )
    return created.data[0]


def _get_or_create_program(dept_id: int, payload: StudentOnboardingRequest):
    existing = (
        supabase.table("program").select("*").eq("program_code", payload.program_code).maybe_single().execute()
    )
    if existing and existing.data:
        return existing.data

    created = (
        supabase.table("program")
        .insert({
            "dept_id": dept_id,
            "program_name": payload.program_name,
            "program_code": payload.program_code,
            "degree_level": payload.degree_level,
            "duration_years": payload.duration_years,
            "total_credits": payload.total_credits,
        })
        .execute()
    )
    return created.data[0]


def _get_authenticated_user(authorization: str):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.removeprefix("Bearer ")

    user_response = supabase.auth.get_user(token)
    user = user_response.user
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    return user


@app.get("/api/me")
def get_me(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.removeprefix("Bearer ")

    user_response = supabase.auth.get_user(token)
    user = user_response.user
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    profile_response = (
        supabase.table("profiles").select("*").eq("id", user.id).single().execute()
    )
    profile = profile_response.data

    return {
        "id": user.id,
        "email": user.email,
        "first_name": profile.get("first_name"),
        "last_name": profile.get("last_name"),
        "role": profile.get("role"),
    }


@app.get("/api/profile")
def get_profile(authorization: str = Header(...)):
    user = _get_authenticated_user(authorization)

    profile_response = (
        supabase.table("profiles").select("role").eq("id", user.id).single().execute()
    )
    role = profile_response.data.get("role")

    view_name = "v_my_instructor_profile" if role == "teacher" else "v_my_student_profile"

    profile_data = (
        supabase.table(view_name).select("*").eq("profile_id", user.id).maybe_single().execute()
    )

    if profile_data is None or profile_data.data is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    return {"role": role, **profile_data.data}


@app.patch("/api/profile")
async def update_profile(request: Request, authorization: str = Header(...)):
    user = _get_authenticated_user(authorization)

    profile_response = (
        supabase.table("profiles").select("role").eq("id", user.id).single().execute()
    )
    role = profile_response.data.get("role")

    body = await request.json()

    locked_fields = INSTRUCTOR_LOCKED_FIELDS if role == "teacher" else STUDENT_LOCKED_FIELDS
    locked_keys_present = locked_fields & body.keys()
    if locked_keys_present:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot update locked fields: {', '.join(sorted(locked_keys_present))}",
        )

    table_name = "instructor" if role == "teacher" else "student"

    update_response = (
        supabase.table(table_name).update(body).eq("profile_id", user.id).execute()
    )

    if not update_response.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    return update_response.data[0]


@app.post("/api/onboarding/student")
def onboard_student(payload: StudentOnboardingRequest, authorization: str = Header(...)):
    user = _get_authenticated_user(authorization)

    profile = (
        supabase.table("profiles")
        .select("role, student_id, instructor_id, first_name, last_name")
        .eq("id", user.id)
        .single()
        .execute()
    ).data

    if profile.get("role") != "student":
        raise HTTPException(status_code=400, detail="Account role is not 'student'")
    if profile.get("student_id") is not None:
        raise HTTPException(status_code=409, detail="Student profile already set up")

    try:
        department = _get_or_create_department(payload.dept_name, payload.dept_code)
        program = _get_or_create_program(department["dept_id"], payload)

        student_row = (
            supabase.table("student")
            .insert({
                "profile_id": user.id,
                "program_id": program["program_id"],
                "first_name": profile["first_name"],
                "last_name": profile["last_name"],
                "gender": payload.gender,
                "date_of_birth": payload.date_of_birth,
                "phone": payload.phone,
                "address": payload.address,
                "student_roll": payload.student_roll,
                "batch_year": payload.batch_year,
                "emergency_contact_name": payload.emergency_contact_name,
                "emergency_contact_phone": payload.emergency_contact_phone,
            })
            .execute()
        ).data[0]

        supabase.table("profiles").update(
            {"student_id": student_row["student_id"]}
        ).eq("id", user.id).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return student_row


# ---- NOTICE BOARD MODELS ----

class NoticeCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(default="")
    category: Literal[
        "academics_exams", "general", "hall_info",
        "transport", "emergency", "upcoming_events"
    ] = "general"
    audience: Literal["all", "students", "teachers"] = "all"


class NoticeUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    content: Optional[str] = None
    category: Optional[Literal[
        "academics_exams", "general", "hall_info",
        "transport", "emergency", "upcoming_events"
    ]] = None
    audience: Optional[Literal["all", "students", "teachers"]] = None


# The frontend `accept=` attribute is a hint, not a control — enforce here.
NOTIFICATION_BATCH_SIZE = 500
MAX_ATTACHMENT_BYTES = 52_428_800  # 50 MB, matches the bucket's file_size_limit
ALLOWED_ATTACHMENT_MIMES = {
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "application/pdf",
    "text/plain", "text/markdown", "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "video/mp4", "video/webm",
    "audio/mpeg", "audio/mp4", "audio/ogg", "audio/webm", "audio/wav",
}


class ReactionRequest(BaseModel):
    reaction: Literal["like", "love", "haha", "wow", "sad", "angry", "fire", "clap", "think", "party"]


class PollCreateRequest(BaseModel):
    question: str = Field(min_length=1)
    options: list[str] = Field(min_length=2, max_length=10)
    is_multiple: bool = False
    ends_at: Optional[str] = None


class VoteRequest(BaseModel):
    option_id: str


async def get_current_user(authorization: Optional[str] = Header(default=None)) -> SimpleUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        header = pyjwt.get_unverified_header(token)
        alg: str = header.get("alg", "HS256")

        # `alg` is attacker-controlled, so it may only select within a key
        # family, never across one — otherwise an RS256 token can be forged as
        # HS256 signed with the public key (algorithm confusion).
        if alg in SYMMETRIC_ALGS:
            if not SUPABASE_JWT_SECRET.strip():
                raise HTTPException(status_code=401, detail="Server not configured for symmetric tokens")
            payload = pyjwt.decode(
                token,
                SUPABASE_JWT_SECRET.strip(),
                algorithms=SYMMETRIC_ALGS,
                options={"verify_aud": False},
            )
        elif alg in ASYMMETRIC_ALGS:
            # Asymmetric (RS256, ES256 …) — verify with Supabase public JWKS key.
            # Keys are fetched once and cached in _jwks_client.
            signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
            payload = pyjwt.decode(
                token,
                signing_key.key,
                algorithms=ASYMMETRIC_ALGS,
                options={"verify_aud": False},
            )
        else:
            raise HTTPException(status_code=401, detail="Unsupported token algorithm")

        user_id: str = payload.get("sub", "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing sub")
        return SimpleUser(id=user_id)
    except HTTPException:
        raise
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Auth error: {exc}")


def _assert_may_target_audience(user_id: str, audience: Optional[str]) -> None:
    """Only teachers may address the teachers-only audience.

    This must be enforced on create *and* update — otherwise a student posts to
    'all' and then PATCHes the audience to 'teachers', bypassing the gate.
    """
    if audience != "teachers":
        return
    profile = supabase.table("profiles").select("role").eq("id", user_id).single().execute()
    if not profile.data or profile.data.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can post teacher-only notices")


def _notify_new_notice(author_id: str, post_title: str, audience: str) -> None:
    """Insert a notification row for every eligible user when a notice is posted."""
    try:
        query = supabase.table("profiles").select("id").neq("id", author_id)
        if audience == "students":
            query = query.eq("role", "student")
        elif audience == "teachers":
            query = query.eq("role", "teacher")
        # audience == 'all' → no role filter
        profiles_res = query.execute()
        if not profiles_res.data:
            return
        rows = [
            {
                "recipient_id": p["id"],
                "sender_id": author_id,
                "notif_type": "new_notice",
                "title": "New notice posted",
                "body": post_title,
                "is_read": False,
            }
            for p in profiles_res.data
        ]
        # Chunked — one row per user in a single insert grows without bound.
        for i in range(0, len(rows), NOTIFICATION_BATCH_SIZE):
            supabase.table("notification").insert(rows[i:i + NOTIFICATION_BATCH_SIZE]).execute()
    except Exception:
        logger.exception("Failed to fan out notice notification for %r", post_title)


@app.get("/api/notices")
async def get_notices(
    category: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    authorization: Optional[str] = Header(default=None),
):
    user = await get_current_user(authorization)
    profile = supabase.table("profiles").select("role").eq("id", user.id).single().execute()
    role = profile.data.get("role", "student") if profile.data else "student"

    query = supabase.table("v_notice_board_posts").select("*")
    if category:
        query = query.eq("category", category)
    if role == "teacher":
        query = query.in_("audience", ["all", "teachers"])
    else:
        query = query.in_("audience", ["all", "students"])

    offset = (page - 1) * limit
    res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"notices": res.data, "page": page, "limit": limit}


@app.post("/api/notices", status_code=201)
async def create_notice(
    body: NoticeCreateRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await get_current_user(authorization)
    _assert_may_target_audience(user.id, body.audience)
    res = supabase.table("notice_board_post").insert({
        "author_id": user.id,
        "title": body.title,
        "content": body.content,
        "category": body.category,
        "audience": body.audience,
    }).execute()
    post_id = res.data[0]["id"]
    full = supabase.table("v_notice_board_posts").select("*").eq("id", post_id).single().execute()
    _notify_new_notice(user.id, body.title, body.audience)
    return full.data


@app.patch("/api/notices/{notice_id}")
async def update_notice(
    notice_id: str,
    body: NoticeUpdateRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await get_current_user(authorization)
    existing = supabase.table("notice_board_post").select("author_id").eq("id", notice_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Notice not found")
    if existing.data["author_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # exclude_unset (not `is not None`) so a field can actually be cleared
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    _assert_may_target_audience(user.id, update_data.get("audience"))

    res = supabase.table("notice_board_post").update(update_data).eq("id", notice_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Notice not found")
    return res.data[0]


@app.delete("/api/notices/{notice_id}", status_code=204)
async def delete_notice(
    notice_id: str,
    authorization: Optional[str] = Header(default=None),
):
    user = await get_current_user(authorization)
    existing = supabase.table("notice_board_post").select("author_id").eq("id", notice_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Notice not found")
    if existing.data["author_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    supabase.table("notice_board_post").delete().eq("id", notice_id).execute()


@app.post("/api/notices/{notice_id}/reactions")
async def upsert_reaction(
    notice_id: str,
    body: ReactionRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await get_current_user(authorization)
    res = supabase.table("notice_board_reaction").upsert({
        "post_id": notice_id,
        "user_id": user.id,
        "reaction": body.reaction,
    }, on_conflict="post_id,user_id").execute()
    return res.data[0]


@app.delete("/api/notices/{notice_id}/reactions", status_code=204)
async def remove_reaction(
    notice_id: str,
    authorization: Optional[str] = Header(default=None),
):
    user = await get_current_user(authorization)
    supabase.table("notice_board_reaction").delete().eq("post_id", notice_id).eq("user_id", user.id).execute()


@app.get("/api/notices/{notice_id}/reactions")
async def get_reactions(
    notice_id: str,
    authorization: Optional[str] = Header(default=None),
):
    user = await get_current_user(authorization)
    res = supabase.table("notice_board_reaction").select("reaction, user_id").eq("post_id", notice_id).execute()
    rows = res.data or []

    # Returning every row exposed which user reacted with what to everyone.
    # Callers only need the tallies plus their own reaction.
    counts: dict = {}
    my_reaction = None
    for r in rows:
        counts[r["reaction"]] = counts.get(r["reaction"], 0) + 1
        if r["user_id"] == user.id:
            my_reaction = r["reaction"]
    return {"counts": counts, "my_reaction": my_reaction, "total": len(rows)}


@app.post("/api/notices/{notice_id}/poll", status_code=201)
async def create_poll(
    notice_id: str,
    body: PollCreateRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await get_current_user(authorization)
    existing = supabase.table("notice_board_post").select("author_id").eq("id", notice_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Notice not found")
    if existing.data["author_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    # post_id is UNIQUE — a second create would surface as a raw 500.
    existing_poll = (
        supabase.table("notice_board_poll").select("id").eq("post_id", notice_id).maybe_single().execute()
    )
    if existing_poll and existing_poll.data:
        raise HTTPException(status_code=409, detail="This notice already has a poll")

    poll_data: dict = {
        "post_id": notice_id,
        "question": body.question,
        "is_multiple": body.is_multiple,
    }
    if body.ends_at:
        poll_data["ends_at"] = body.ends_at
    poll_res = supabase.table("notice_board_poll").insert(poll_data).execute()
    poll_id = poll_res.data[0]["id"]
    options = [
        {"poll_id": poll_id, "option_text": opt, "display_order": i}
        for i, opt in enumerate(body.options)
    ]
    supabase.table("notice_board_poll_option").insert(options).execute()
    supabase.table("notice_board_post").update({"has_poll": True}).eq("id", notice_id).execute()
    return {"poll_id": poll_id}


@app.get("/api/notices/{notice_id}/poll")
async def get_poll(
    notice_id: str,
    authorization: Optional[str] = Header(default=None),
):
    user = await get_current_user(authorization)
    poll = supabase.table("notice_board_poll").select("*").eq("post_id", notice_id).maybe_single().execute()
    if not poll or not poll.data:
        raise HTTPException(status_code=404, detail="No poll found")
    options = (
        supabase.table("notice_board_poll_option")
        .select("*")
        .eq("poll_id", poll.data["id"])
        .order("display_order")
        .execute()
    )
    votes = (
        supabase.table("notice_board_poll_vote")
        .select("option_id, user_id")
        .eq("poll_id", poll.data["id"])
        .execute()
    )
    my_votes = [v["option_id"] for v in votes.data if v["user_id"] == user.id]
    vote_counts: dict = {}
    for v in votes.data:
        vote_counts[v["option_id"]] = vote_counts.get(v["option_id"], 0) + 1
    return {
        "poll": poll.data,
        "options": options.data,
        "vote_counts": vote_counts,
        "my_votes": my_votes,
    }


@app.post("/api/notices/{notice_id}/poll/vote", status_code=201)
async def cast_vote(
    notice_id: str,
    body: VoteRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await get_current_user(authorization)
    poll = (
        supabase.table("notice_board_poll")
        .select("id, is_multiple, ends_at")
        .eq("post_id", notice_id)
        .maybe_single()
        .execute()
    )
    if not poll or not poll.data:
        raise HTTPException(status_code=404, detail="No poll")

    ends_at = poll.data.get("ends_at")
    if ends_at:
        deadline = datetime.fromisoformat(str(ends_at).replace("Z", "+00:00"))
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        if deadline < datetime.now(timezone.utc):
            raise HTTPException(status_code=409, detail="This poll has closed")

    # The option must belong to THIS poll — UNIQUE(option_id, user_id) does not
    # stop a vote cast with an option id borrowed from a different poll.
    option = (
        supabase.table("notice_board_poll_option")
        .select("id")
        .eq("id", body.option_id)
        .eq("poll_id", poll.data["id"])
        .maybe_single()
        .execute()
    )
    if not option or not option.data:
        raise HTTPException(status_code=400, detail="Option does not belong to this poll")

    already = (
        supabase.table("notice_board_poll_vote")
        .select("id, option_id")
        .eq("poll_id", poll.data["id"])
        .eq("user_id", user.id)
        .execute()
    ).data or []
    if any(v["option_id"] == body.option_id for v in already):
        raise HTTPException(status_code=409, detail="You already voted for this option")
    if already and not poll.data.get("is_multiple"):
        # Single-choice: replace the previous vote rather than 500ing on the
        # single-choice DB trigger.
        supabase.table("notice_board_poll_vote").delete().eq(
            "poll_id", poll.data["id"]
        ).eq("user_id", user.id).execute()

    res = supabase.table("notice_board_poll_vote").insert({
        "poll_id": poll.data["id"],
        "option_id": body.option_id,
        "user_id": user.id,
    }).execute()
    return res.data[0]


@app.get("/api/notices/{notice_id}/attachments")
async def get_attachments(
    notice_id: str,
    authorization: Optional[str] = Header(default=None),
):
    await get_current_user(authorization)
    res = supabase.table("notice_board_attachment").select("*").eq("post_id", notice_id).execute()
    return res.data


@app.post("/api/notices/{notice_id}/attachments", status_code=201)
async def upload_attachment(
    notice_id: str,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
):
    import uuid as _uuid

    user = await get_current_user(authorization)
    existing = supabase.table("notice_board_post").select("author_id").eq("id", notice_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Notice not found")
    if existing.data["author_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    mime_in = (file.content_type or "application/octet-stream").split(";")[0].strip().lower()
    if mime_in not in ALLOWED_ATTACHMENT_MIMES:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {mime_in}")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "bin"
    storage_path = f"{notice_id}/{_uuid.uuid4()}.{ext}"

    content = await file.read()
    if len(content) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {MAX_ATTACHMENT_BYTES // 1048576} MB limit",
        )

    supabase.storage.from_("notice-attachments").upload(
        storage_path, content, {"content-type": file.content_type}
    )
    file_url = supabase.storage.from_("notice-attachments").get_public_url(storage_path)

    mime = file.content_type or ""
    if mime.startswith("image/"):
        ftype = "image"
    elif mime == "application/pdf":
        ftype = "pdf"
    elif "word" in mime:
        ftype = "doc"
    elif "text/markdown" in mime or ext == "md":
        ftype = "markdown"
    elif mime == "video/mp4":
        ftype = "mp4"
    elif "audio" in mime or ext in ("mp3", "m4a", "ogg", "webm"):
        ftype = "audio"
    else:
        ftype = "other"

    res = supabase.table("notice_board_attachment").insert({
        "post_id": notice_id,
        "file_url": file_url,
        "file_name": file.filename or storage_path,
        "file_type": ftype,
        "file_size": len(content),
        "mime_type": mime,
    }).execute()
    return res.data[0]


@app.post("/api/onboarding/instructor")
def onboard_instructor(payload: InstructorOnboardingRequest, authorization: str = Header(...)):
    user = _get_authenticated_user(authorization)

    profile = (
        supabase.table("profiles")
        .select("role, student_id, instructor_id, first_name, last_name")
        .eq("id", user.id)
        .single()
        .execute()
    ).data

    if profile.get("role") != "teacher":
        raise HTTPException(status_code=400, detail="Account role is not 'teacher'")
    if profile.get("instructor_id") is not None:
        raise HTTPException(status_code=409, detail="Instructor profile already set up")

    try:
        department = _get_or_create_department(payload.dept_name, payload.dept_code)

        instructor_row = (
            supabase.table("instructor")
            .insert({
                "profile_id": user.id,
                "dept_id": department["dept_id"],
                "first_name": profile["first_name"],
                "last_name": profile["last_name"],
                "gender": payload.gender,
                "date_of_birth": payload.date_of_birth,
                "phone": payload.phone,
                "office_location": payload.office_location,
                "employee_id": payload.employee_id,
                "designation": payload.designation,
                "specialization": payload.specialization,
                "bio": payload.bio,
            })
            .execute()
        ).data[0]

        supabase.table("profiles").update(
            {"instructor_id": instructor_row["instructor_id"]}
        ).eq("id", user.id).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return instructor_row
