import os
from contextlib import asynccontextmanager
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Header, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        supabase.storage.create_bucket(
            "notice-attachments",
            options={"public": True, "file_size_limit": 52428800},
        )
    except Exception:
        pass  # bucket already exists
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://cse-2202-project.vercel.app"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Fields rejected by the DB guard triggers for self-service updates
# (trg_student_profile_guard / trg_instructor_profile_guard in profile_feature.sql)
STUDENT_LOCKED_FIELDS = {
    "profile_id", "program_id", "student_roll", "admission_date",
    "batch_year", "current_semester", "cgpa", "total_credits", "is_active",
}
INSTRUCTOR_LOCKED_FIELDS = {
    "profile_id", "dept_id", "employee_id", "hire_date", "designation", "is_active",
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


class ReactionRequest(BaseModel):
    reaction: Literal["like", "love", "haha", "wow", "sad", "angry", "fire", "clap", "think", "party"]


class PollCreateRequest(BaseModel):
    question: str = Field(min_length=1)
    options: list[str] = Field(min_length=2, max_length=10)
    is_multiple: bool = False
    ends_at: Optional[str] = None


class VoteRequest(BaseModel):
    option_id: str


async def get_current_user(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    res = supabase.auth.get_user(token)
    if not res.user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return res.user


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
    if body.audience == "teachers":
        profile = supabase.table("profiles").select("role").eq("id", user.id).single().execute()
        if not profile.data or profile.data.get("role") != "teacher":
            raise HTTPException(status_code=403, detail="Only teachers can post teacher-only notices")
    res = supabase.table("notice_board_post").insert({
        "author_id": user.id,
        "title": body.title,
        "content": body.content,
        "category": body.category,
        "audience": body.audience,
    }).execute()
    post_id = res.data[0]["id"]
    full = supabase.table("v_notice_board_posts").select("*").eq("id", post_id).single().execute()
    return full.data


@app.patch("/api/notices/{notice_id}")
async def update_notice(
    notice_id: str,
    body: NoticeUpdateRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await get_current_user(authorization)
    existing = supabase.table("notice_board_post").select("author_id").eq("id", notice_id).single().execute()
    if not existing.data or existing.data["author_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    res = supabase.table("notice_board_post").update(update_data).eq("id", notice_id).execute()
    return res.data[0]


@app.delete("/api/notices/{notice_id}", status_code=204)
async def delete_notice(
    notice_id: str,
    authorization: Optional[str] = Header(default=None),
):
    user = await get_current_user(authorization)
    existing = supabase.table("notice_board_post").select("author_id").eq("id", notice_id).single().execute()
    if not existing.data or existing.data["author_id"] != user.id:
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
    await get_current_user(authorization)
    res = supabase.table("notice_board_reaction").select("reaction, user_id").eq("post_id", notice_id).execute()
    return res.data


@app.post("/api/notices/{notice_id}/poll", status_code=201)
async def create_poll(
    notice_id: str,
    body: PollCreateRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await get_current_user(authorization)
    existing = supabase.table("notice_board_post").select("author_id").eq("id", notice_id).single().execute()
    if not existing.data or existing.data["author_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
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
    poll = supabase.table("notice_board_poll").select("*").eq("post_id", notice_id).single().execute()
    if not poll.data:
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
    poll = supabase.table("notice_board_poll").select("id").eq("post_id", notice_id).single().execute()
    if not poll.data:
        raise HTTPException(status_code=404, detail="No poll")
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
    existing = supabase.table("notice_board_post").select("author_id").eq("id", notice_id).single().execute()
    if not existing.data or existing.data["author_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "bin"
    storage_path = f"{notice_id}/{_uuid.uuid4()}.{ext}"
    content = await file.read()
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
