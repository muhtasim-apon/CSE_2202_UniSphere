import os
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://cse-2202-project.vercel.app"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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
