import os
import random
import string
import uuid as _uuid
from datetime import datetime, timezone
from typing import Optional

import jwt as pyjwt
from jwt import PyJWKClient as _PyJWKClient
from dotenv import load_dotenv
from fastapi import APIRouter, File, Form, HTTPException, Header, Query, Request, UploadFile
from pydantic import BaseModel, Field
from supabase import create_client

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

load_dotenv()

_supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

_jwt_secret = os.environ.get("SUPABASE_JWT_SECRET", "")
_jwks_inst: Optional[_PyJWKClient] = None

def _get_jwks_inst() -> _PyJWKClient:
    global _jwks_inst
    if _jwks_inst is None:
        _jwks_inst = _PyJWKClient(f"{os.environ['SUPABASE_URL']}/auth/v1/.well-known/jwks.json")
    return _jwks_inst

router = APIRouter(prefix="/api/classes", tags=["classes"])


# ── AUTH ──────────────────────────────────────────────────────────────────────

async def _auth(authorization: Optional[str]) -> object:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        header = pyjwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
        if alg.startswith("HS"):
            payload = pyjwt.decode(token, _jwt_secret, algorithms=[alg], options={"verify_aud": False})
        else:
            sk = _get_jwks_inst().get_signing_key_from_jwt(token)
            payload = pyjwt.decode(token, sk.key, algorithms=[alg], options={"verify_aud": False})
        uid = payload.get("sub", "")
        if not uid:
            raise HTTPException(status_code=401, detail="Invalid token")
        class _U:
            def __init__(self, i): self.id = i
        return _U(uid)
    except HTTPException:
        raise
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Auth error: {exc}")


def _get_profile(user_id: str) -> dict:
    row = (
        _supabase.table("profiles")
        .select("role, student_id, instructor_id")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return row.data


def _require_teacher(profile: dict) -> int:
    if profile.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    iid = profile.get("instructor_id")
    if not iid:
        raise HTTPException(status_code=400, detail="Instructor profile not set up")
    return iid


def _require_student(profile: dict) -> int:
    if profile.get("role") != "student":
        raise HTTPException(status_code=403, detail="Student access required")
    sid = profile.get("student_id")
    if not sid:
        raise HTTPException(status_code=400, detail="Student profile not set up")
    return sid


# ── GRADE HELPER ──────────────────────────────────────────────────────────────

def _compute_grade(marks: float, total: float) -> tuple[str, float]:
    pct = (marks / total) * 100
    if pct >= 80:  return ("A+", 4.00)
    if pct >= 75:  return ("A",  3.75)
    if pct >= 70:  return ("A-", 3.50)
    if pct >= 65:  return ("B+", 3.25)
    if pct >= 60:  return ("B",  3.00)
    if pct >= 55:  return ("B-", 2.75)
    if pct >= 50:  return ("C+", 2.50)
    if pct >= 45:  return ("C",  2.25)
    if pct >= 40:  return ("D",  2.00)
    return ("F", 0.00)


def _notify_enrolled(manual_course_id: int, sender_id: str, title: str, body: str) -> None:
    try:
        enrollments = (
            _supabase.table("manual_enrollment")
            .select("student_id, student:student(profile_id)")
            .eq("manual_course_id", manual_course_id)
            .eq("is_active", True)
            .execute()
        )
        rows = []
        for e in (enrollments.data or []):
            pid = (e.get("student") or {}).get("profile_id")
            if pid and pid != sender_id:
                rows.append({
                    "recipient_id": pid,
                    "sender_id": sender_id,
                    "notif_type": "general",
                    "title": title,
                    "body": body,
                    "is_read": False,
                })
        if rows:
            _supabase.table("notification").insert(rows).execute()
    except Exception:
        pass


# ── MODELS ────────────────────────────────────────────────────────────────────

class ManualCourseCreate(BaseModel):
    course_name:     str            = Field(min_length=1, max_length=255)
    course_code:     Optional[str]  = Field(default=None, max_length=50)
    description:     Optional[str]  = None
    credit_hours:    float          = Field(default=3.0, gt=0)
    enroll_code:     Optional[str]  = Field(default=None, max_length=20)
    semester:        Optional[str]  = Field(default=None, max_length=50)
    academic_year:   Optional[str]  = Field(default=None, max_length=20)
    semester_number: Optional[int]  = Field(default=None, ge=1, le=8)


class JoinCourseRequest(BaseModel):
    enroll_code: str = Field(min_length=1, max_length=20)


class AttendanceSessionCreate(BaseModel):
    manual_course_id: int
    session_date:  Optional[str] = None
    session_title: Optional[str] = None
    topic:         Optional[str] = None
    notes:         Optional[str] = None


class AttendanceRecordUpdate(BaseModel):
    status:  str            = Field(pattern="^(Present|Absent|Late|Excused)$")
    remarks: Optional[str]  = Field(default=None, max_length=200)


class ExamCreate(BaseModel):
    manual_course_id: Optional[int] = None
    exam_name:    str           = Field(min_length=1, max_length=255)
    exam_type:    str           = Field(default="Midterm")
    total_marks:  float         = Field(gt=0)
    credit_hours: float         = Field(default=3.0, gt=0)
    exam_date:    Optional[str] = None
    semester:     Optional[str] = None
    academic_year:Optional[str] = None
    description:  Optional[str] = None


class MarkEntry(BaseModel):
    student_id:     int
    marks_obtained: float = Field(ge=0)
    remarks:        Optional[str] = None


class SingleMarkRequest(BaseModel):
    marks_obtained: float = Field(ge=0)
    remarks:        Optional[str] = None


class HireDateRequest(BaseModel):
    hire_date: str


class AdvisorUpdateRequest(BaseModel):
    advisor_name:    Optional[str] = Field(default=None, max_length=120)
    advisor_user_id: Optional[int] = None


# ══════════════════════════════════════════════════════════════════════════════
# MANUAL COURSES
# ══════════════════════════════════════════════════════════════════════════════

def _gen_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


@router.post("/manual/create", status_code=201)
async def create_manual_course(body: ManualCourseCreate, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    instructor_id = _require_teacher(profile)

    code = (body.enroll_code or _gen_code()).upper()
    while True:
        res = _supabase.table("manual_course").select("manual_course_id").eq("enroll_code", code).maybe_single().execute()
        if not res or not res.data:
            break
        code = _gen_code()

    res = _supabase.table("manual_course").insert({
        "instructor_id":   instructor_id,
        "course_name":     body.course_name,
        "course_code":     body.course_code,
        "description":     body.description,
        "credit_hours":    body.credit_hours,
        "enroll_code":     code,
        "semester":        body.semester,
        "academic_year":   body.academic_year,
        "semester_number": body.semester_number,
    }).execute()
    return res.data[0]


@router.post("/manual/join")
async def join_manual_course(body: JoinCourseRequest, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    student_id = _require_student(profile)

    course = (
        _supabase.table("manual_course")
        .select("*, instructor:instructor(first_name, last_name)")
        .eq("enroll_code", body.enroll_code.upper())
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    if not course or not course.data:
        raise HTTPException(status_code=404, detail="No active course found with that code")

    if _supabase.table("manual_enrollment").select("enrollment_id").eq("manual_course_id", course.data["manual_course_id"]).eq("student_id", student_id).maybe_single().execute().data:
        raise HTTPException(status_code=409, detail="Already enrolled")

    enrollment = _supabase.table("manual_enrollment").insert({
        "manual_course_id": course.data["manual_course_id"],
        "student_id": student_id,
    }).execute()
    return {"enrollment": enrollment.data[0], "course": course.data}


@router.get("/manual")
async def list_manual_courses(authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)

    if profile.get("role") == "teacher":
        instructor_id = _require_teacher(profile)
        courses = _supabase.table("manual_course").select("*").eq("instructor_id", instructor_id).order("created_at", desc=True).execute().data or []
        for c in courses:
            c["enrollment_count"] = _supabase.table("manual_enrollment").select("enrollment_id", count="exact").eq("manual_course_id", c["manual_course_id"]).eq("is_active", True).execute().count or 0
        return {"courses": courses}
    else:
        student_id = _require_student(profile)
        res = _supabase.table("manual_enrollment").select("*, course:manual_course(*, instructor:instructor(first_name, last_name))").eq("student_id", student_id).eq("is_active", True).execute()
        return {"courses": [e["course"] for e in (res.data or []) if e.get("course")]}


@router.get("/manual/{manual_course_id}/students")
async def get_course_students(manual_course_id: int, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    instructor_id = _require_teacher(profile)

    course = _supabase.table("manual_course").select("instructor_id").eq("manual_course_id", manual_course_id).single().execute()
    if not course.data or course.data["instructor_id"] != instructor_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    res = _supabase.table("manual_enrollment").select("*, student:student(student_id, first_name, last_name, student_roll)").eq("manual_course_id", manual_course_id).eq("is_active", True).execute()
    return {"students": res.data or []}


@router.delete("/manual/{manual_course_id}", status_code=204)
async def delete_manual_course(manual_course_id: int, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    instructor_id = _require_teacher(profile)

    course = _supabase.table("manual_course").select("instructor_id").eq("manual_course_id", manual_course_id).single().execute()
    if not course.data or course.data["instructor_id"] != instructor_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    _supabase.table("manual_course").update({"is_active": False}).eq("manual_course_id", manual_course_id).execute()


# ══════════════════════════════════════════════════════════════════════════════
# ATTENDANCE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/attendance/session", status_code=201)
async def create_attendance_session(body: AttendanceSessionCreate, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    instructor_id = _require_teacher(profile)

    session_res = _supabase.table("attendance_session").insert({
        "manual_course_id": body.manual_course_id,
        "instructor_id":    instructor_id,
        "session_date":     body.session_date or datetime.now().date().isoformat(),
        "session_title":    body.session_title,
        "topic":            body.topic,
        "notes":            body.notes,
    }).execute()
    session = session_res.data[0]

    enrollments = _supabase.table("manual_enrollment").select("student_id").eq("manual_course_id", body.manual_course_id).eq("is_active", True).execute()
    student_ids = [e["student_id"] for e in (enrollments.data or [])]

    records = []
    if student_ids:
        rows = [{"session_id": session["session_id"], "student_id": sid, "status": "Present"} for sid in student_ids]
        records = _supabase.table("attendance_record").insert(rows).execute().data or []

    _notify_enrolled(body.manual_course_id, user.id, "Attendance started", f"Session: {body.session_title or body.topic or 'Today'}")
    return {"session": session, "records": records}


@router.patch("/attendance/session/{session_id}/record/{student_id}")
async def update_attendance_record(session_id: int, student_id: int, body: AttendanceRecordUpdate, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    instructor_id = _require_teacher(profile)

    session = _supabase.table("attendance_session").select("instructor_id").eq("session_id", session_id).single().execute()
    if not session.data or session.data["instructor_id"] != instructor_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    res = _supabase.table("attendance_record").upsert({
        "session_id": session_id,
        "student_id": student_id,
        "status":     body.status,
        "remarks":    body.remarks,
        "marked_at":  datetime.now(timezone.utc).isoformat(),
    }, on_conflict="session_id,student_id").execute()
    return res.data[0]


@router.get("/attendance/session/{session_id}")
async def get_attendance_session(session_id: int, authorization: Optional[str] = Header(default=None)):
    await _auth(authorization)
    session = _supabase.table("attendance_session").select("*").eq("session_id", session_id).single().execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    records = _supabase.table("attendance_record").select("*, student:student(first_name, last_name, student_roll)").eq("session_id", session_id).execute().data or []
    total = len(records)
    return {
        "session": session.data,
        "records": records,
        "summary": {
            "total": total,
            "present": sum(1 for r in records if r["status"] == "Present"),
            "absent":  sum(1 for r in records if r["status"] == "Absent"),
            "late":    sum(1 for r in records if r["status"] == "Late"),
        },
    }


@router.get("/attendance/my-summary")
async def my_attendance_summary(authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    student_id = _require_student(profile)

    records = _supabase.table("attendance_record").select("status, session:attendance_session(manual_course_id, course:manual_course(course_name))").eq("student_id", student_id).execute().data or []

    stats: dict = {}
    for r in records:
        sess = r.get("session") or {}
        cid = sess.get("manual_course_id")
        if not cid:
            continue
        name = (sess.get("course") or {}).get("course_name", f"Course {cid}")
        stats.setdefault(cid, {"course_id": cid, "course_name": name, "total": 0, "present": 0, "absent": 0, "late": 0})
        stats[cid]["total"] += 1
        s = r["status"]
        if s == "Present": stats[cid]["present"] += 1
        elif s == "Absent": stats[cid]["absent"] += 1
        elif s == "Late":   stats[cid]["late"] += 1

    summary = []
    for cid, s in stats.items():
        attended = s["present"] + s["late"]
        pct = round((attended / s["total"]) * 100, 1) if s["total"] else 0
        summary.append({**s, "attendance_pct": pct})
    return {"summary": summary}


@router.get("/attendance/course/{manual_course_id}")
async def course_attendance(manual_course_id: int, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    instructor_id = _require_teacher(profile)

    course = _supabase.table("manual_course").select("instructor_id").eq("manual_course_id", manual_course_id).single().execute()
    if not course.data or course.data["instructor_id"] != instructor_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    sessions = _supabase.table("attendance_session").select("*").eq("manual_course_id", manual_course_id).order("session_date", desc=True).execute()
    return {"sessions": sessions.data or []}


@router.get("/attendance/course/{manual_course_id}/full")
async def course_attendance_full(manual_course_id: int, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    instructor_id = _require_teacher(profile)

    course = _supabase.table("manual_course").select("instructor_id").eq("manual_course_id", manual_course_id).single().execute()
    if not course.data or course.data["instructor_id"] != instructor_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    sessions = _supabase.table("attendance_session").select("*").eq("manual_course_id", manual_course_id).order("session_date", desc=True).execute().data or []
    for s in sessions:
        recs = _supabase.table("attendance_record").select("*, student:student(first_name,last_name,student_roll)").eq("session_id", s["session_id"]).execute().data or []
        s["records"] = recs
        s["summary"] = {
            "present":  sum(1 for r in recs if r["status"] == "Present"),
            "absent":   sum(1 for r in recs if r["status"] == "Absent"),
            "late":     sum(1 for r in recs if r["status"] == "Late"),
            "excused":  sum(1 for r in recs if r["status"] == "Excused"),
            "total":    len(recs),
        }
    return {"sessions": sessions}


@router.get("/attendance/my-detail")
async def my_attendance_detail(authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    student_id = _require_student(profile)

    enrollments = _supabase.table("manual_enrollment").select(
        "manual_course_id, course:manual_course(course_name,course_code,semester)"
    ).eq("student_id", student_id).eq("is_active", True).execute().data or []

    if not enrollments:
        return {"courses": []}

    course_ids = [e["manual_course_id"] for e in enrollments]

    # Fetch all sessions for all enrolled courses in one query
    all_sessions = _supabase.table("attendance_session").select("*").in_(
        "manual_course_id", course_ids
    ).order("session_date", desc=False).execute().data or []

    # Fetch all attendance records for this student in one query
    session_ids = [s["session_id"] for s in all_sessions]
    records_by_session: dict = {}
    if session_ids:
        all_records = _supabase.table("attendance_record").select("session_id,status,remarks").in_(
            "session_id", session_ids
        ).eq("student_id", student_id).execute().data or []
        for r in all_records:
            records_by_session[r["session_id"]] = r

    # Group sessions by course
    sessions_by_course: dict = {}
    for s in all_sessions:
        sessions_by_course.setdefault(s["manual_course_id"], []).append(s)

    result = []
    for enr in enrollments:
        course = enr.get("course") or {}
        cid = enr["manual_course_id"]
        sessions = sessions_by_course.get(cid, [])

        present = absent = late = excused = 0
        session_detail = []
        for s in sessions:
            rec = records_by_session.get(s["session_id"])
            status = rec["status"] if rec else None
            if status == "Present":   present += 1
            elif status == "Absent":  absent += 1
            elif status == "Late":    late += 1
            elif status == "Excused": excused += 1
            session_detail.append({
                "session_id":    s["session_id"],
                "session_date":  s["session_date"],
                "session_title": s.get("session_title"),
                "topic":         s.get("topic"),
                "status":        status,
                "remarks":       rec["remarks"] if rec else None,
            })

        total = present + absent + late + excused
        pct = round(((present + late) / total) * 100, 1) if total else 0.0
        result.append({
            "course_id":      cid,
            "course_name":    course.get("course_name", f"Course {cid}"),
            "course_code":    course.get("course_code"),
            "semester":       course.get("semester"),
            "total_sessions": total,
            "present":  present,
            "absent":   absent,
            "late":     late,
            "excused":  excused,
            "attendance_pct": pct,
            "sessions": session_detail,
        })
    return {"courses": result}


@router.get("/exams/course/{manual_course_id}/gradebook")
async def course_gradebook(manual_course_id: int, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    instructor_id = _require_teacher(profile)

    course = _supabase.table("manual_course").select("instructor_id").eq("manual_course_id", manual_course_id).single().execute()
    if not course.data or course.data["instructor_id"] != instructor_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    exams = _supabase.table("exam").select("exam_id,exam_name,exam_type,total_marks,credit_hours,exam_date").eq("manual_course_id", manual_course_id).order("created_at").execute().data or []
    enrollments = _supabase.table("manual_enrollment").select("student_id,student:student(first_name,last_name,student_roll)").eq("manual_course_id", manual_course_id).eq("is_active", True).execute().data or []

    if not exams or not enrollments:
        return {"exams": exams, "students": []}

    exam_ids = [e["exam_id"] for e in exams]
    student_ids = [e["student_id"] for e in enrollments]
    marks_res = _supabase.table("exam_mark").select("*").in_("exam_id", exam_ids).in_("student_id", student_ids).execute().data or []

    marks_map: dict = {}
    for m in marks_res:
        marks_map.setdefault(m["student_id"], {})[m["exam_id"]] = m

    students_data = []
    for enr in enrollments:
        sid = enr["student_id"]
        st = enr.get("student") or {}
        students_data.append({
            "student_id":   sid,
            "first_name":   st.get("first_name", ""),
            "last_name":    st.get("last_name", ""),
            "student_roll": st.get("student_roll", ""),
            "marks": marks_map.get(sid, {}),
        })
    students_data.sort(key=lambda s: s["student_roll"])
    return {"exams": exams, "students": students_data}


@router.get("/exams/my-marks")
async def my_all_marks(authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    student_id = _require_student(profile)

    enrollments = _supabase.table("manual_enrollment").select(
        "manual_course_id,course:manual_course(course_name,course_code,semester)"
    ).eq("student_id", student_id).eq("is_active", True).execute().data or []

    marks = _supabase.table("exam_mark").select(
        "marks_obtained,grade,grade_points,remarks,exam:exam(exam_id,exam_name,exam_type,total_marks,credit_hours,exam_date,manual_course_id)"
    ).eq("student_id", student_id).execute().data or []

    by_course: dict = {}
    for m in marks:
        exam = m.get("exam") or {}
        cid  = exam.get("manual_course_id")
        if not cid: continue
        etype = exam.get("exam_type", "Other")
        entry = {
            "exam_id":       exam.get("exam_id"),
            "exam_name":     exam.get("exam_name"),
            "exam_type":     etype,
            "total_marks":   exam.get("total_marks"),
            "credit_hours":  exam.get("credit_hours"),
            "exam_date":     exam.get("exam_date"),
            "marks_obtained":m.get("marks_obtained"),
            "grade":         m.get("grade"),
            "grade_points":  m.get("grade_points"),
            "remarks":       m.get("remarks"),
        }
        by_course.setdefault(cid, {}).setdefault(etype, []).append(entry)

    result = []
    for enr in enrollments:
        cid    = enr["manual_course_id"]
        course = enr.get("course") or {}
        by_type = by_course.get(cid, {})
        for lst in by_type.values():
            lst.sort(key=lambda x: x.get("exam_date") or "")
        result.append({
            "course_id":   cid,
            "course_name": course.get("course_name", f"Course {cid}"),
            "course_code": course.get("course_code"),
            "semester":    course.get("semester"),
            "by_type":     by_type,
        })
    return {"courses": result}


# ══════════════════════════════════════════════════════════════════════════════
# EXAMS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/exams", status_code=201)
async def create_exam(body: ExamCreate, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    _require_teacher(profile)   # teachers only
    res = _supabase.table("exam").insert({
        "manual_course_id": body.manual_course_id,
        "exam_name":    body.exam_name,
        "exam_type":    body.exam_type,
        "total_marks":  body.total_marks,
        "credit_hours": body.credit_hours,
        "exam_date":    body.exam_date,
        "semester":     body.semester,
        "academic_year":body.academic_year,
        "description":  body.description,
        "created_by":   user.id,
    }).execute()
    return res.data[0]


@router.get("/exams")
async def list_exams(
    course_id: Optional[int] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    profile = _get_profile(user.id)

    if profile.get("role") == "teacher":
        query = _supabase.table("exam").select("*").eq("created_by", user.id)
        if course_id is not None:
            query = query.eq("manual_course_id", course_id)
        res = query.order("created_at", desc=True).execute()
        return {"exams": res.data or []}

    student_id = _require_student(profile)
    query = _supabase.table("exam").select("*").eq("is_published", True)
    if course_id is not None:
        query = query.eq("manual_course_id", course_id)
    exams = query.order("created_at", desc=True).execute().data or []
    if exams:
        ids = [e["exam_id"] for e in exams]
        marks = _supabase.table("exam_mark").select("*").eq("student_id", student_id).in_("exam_id", ids).execute().data or []
        mmap = {m["exam_id"]: m for m in marks}
        for e in exams:
            e["my_mark"] = mmap.get(e["exam_id"])
    return {"exams": exams}


@router.put("/exams/{exam_id}/marks/{student_id}")
async def upsert_mark(exam_id: int, student_id: int, body: SingleMarkRequest, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    _require_teacher(profile)   # teachers only — students cannot enter marks

    exam = _supabase.table("exam").select("total_marks").eq("exam_id", exam_id).single().execute()
    if not exam.data:
        raise HTTPException(status_code=404, detail="Exam not found")

    grade, gp = _compute_grade(body.marks_obtained, float(exam.data["total_marks"]))
    res = _supabase.table("exam_mark").upsert({
        "exam_id":        exam_id,
        "student_id":     student_id,
        "marks_obtained": body.marks_obtained,
        "grade":          grade,
        "grade_points":   gp,
        "remarks":        body.remarks,
        "entered_by":     user.id,
    }, on_conflict="exam_id,student_id").execute()

    # Notify the student
    try:
        sp = _supabase.table("student").select("profile_id").eq("student_id", student_id).maybe_single().execute()
        if sp and sp.data:
            _supabase.table("notification").insert({
                "recipient_id": sp.data["profile_id"],
                "sender_id":    user.id,
                "notif_type":   "general",
                "title":        "Exam mark entered",
                "body":         f"Your mark: {grade} ({body.marks_obtained}/{exam.data['total_marks']})",
                "is_read":      False,
            }).execute()
    except Exception:
        pass

    # Auto-recalculate CGPA after mark entry
    try:
        result = _calc_cgpa(student_id)
        _supabase.table("student").update({
            "cgpa":          result["cgpa"],
            "total_credits": int(result["total_credits"]),
        }).eq("student_id", student_id).execute()
        _supabase.table("cgpa_record").insert({
            "student_id":    student_id,
            "cgpa":          result["cgpa"],
            "total_credits": result["total_credits"],
            "total_points":  result["total_points"],
            "exam_count":    result["exam_count"],
            "source":        "exam_marks",
        }).execute()
    except Exception:
        pass

    return res.data[0]


@router.get("/exams/{exam_id}/marks")
async def get_exam_marks(exam_id: int, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)

    if profile.get("role") == "teacher":
        res = _supabase.table("exam_mark").select("*, student:student(first_name, last_name, student_roll)").eq("exam_id", exam_id).execute()
        return {"marks": res.data or []}

    student_id = _require_student(profile)
    res = _supabase.table("exam_mark").select("*").eq("exam_id", exam_id).eq("student_id", student_id).maybe_single().execute()
    return {"mark": res.data}


# ══════════════════════════════════════════════════════════════════════════════
# CGPA
# ══════════════════════════════════════════════════════════════════════════════

def _calc_cgpa(student_id: int) -> dict:
    marks = (
        _supabase.table("exam_mark")
        .select("*, exam:exam(exam_name, exam_type, total_marks, credit_hours, manual_course_id, manual_course:manual_course(course_name, course_code, semester_number))")
        .eq("student_id", student_id)
        .execute().data or []
    )
    weighted, credits = 0.0, 0.0
    breakdown = []
    for m in marks:
        exam = m.get("exam") or {}
        mc   = (exam.get("manual_course") or {})
        gp, ch = m.get("grade_points"), exam.get("credit_hours")
        if gp is not None and ch is not None:
            weighted += float(gp) * float(ch)
            credits  += float(ch)
        breakdown.append({
            "exam_name":     exam.get("exam_name"),
            "exam_type":     exam.get("exam_type"),
            "grade":         m.get("grade"),
            "grade_points":  m.get("grade_points"),
            "credit_hours":  ch,
            "marks_obtained":m.get("marks_obtained"),
            "total_marks":   exam.get("total_marks"),
            "course_name":   mc.get("course_name"),
            "course_code":   mc.get("course_code"),
        })
    cgpa = round(weighted / credits, 2) if credits > 0 else 0.0
    return {"cgpa": cgpa, "total_credits": credits, "total_points": weighted, "exam_count": len(marks), "breakdown": breakdown}


@router.get("/cgpa")
async def get_cgpa(authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    student_id = _require_student(profile)
    return _calc_cgpa(student_id)


@router.post("/cgpa/recalculate")
async def recalculate_cgpa(authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    student_id = _require_student(profile)

    old = _supabase.table("student").select("cgpa").eq("student_id", student_id).single().execute()
    prev = float((old.data or {}).get("cgpa") or 0)

    result = _calc_cgpa(student_id)
    new_cgpa = result["cgpa"]

    _supabase.table("student").update({"cgpa": new_cgpa, "total_credits": int(result["total_credits"])}).eq("student_id", student_id).execute()
    _supabase.table("cgpa_record").insert({
        "student_id":    student_id,
        "cgpa":          new_cgpa,
        "total_credits": result["total_credits"],
        "total_points":  result["total_points"],
        "exam_count":    result["exam_count"],
        "source":        "exam_marks",
    }).execute()

    return {"new_cgpa": new_cgpa, "previous_cgpa": prev, "changed": abs(new_cgpa - prev) > 0.001, **result}


# ══════════════════════════════════════════════════════════════════════════════
# PROFILE DATE ENDPOINTS  (separate router mounted at /api/profile)
# ══════════════════════════════════════════════════════════════════════════════

profile_router = APIRouter(prefix="/api/profile", tags=["profile-dates"])


@profile_router.patch("/hire-date")
async def update_hire_date(body: HireDateRequest, authorization: Optional[str] = Header(default=None)):
    from datetime import date as _date
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    res = _supabase.auth.get_user(authorization.split(" ", 1)[1])
    if not res.user:
        raise HTTPException(status_code=401, detail="Invalid token")
    try:
        _date.fromisoformat(body.hire_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date, use YYYY-MM-DD")
    upd = _supabase.table("instructor").update({"hire_date": body.hire_date}).eq("profile_id", res.user.id).execute()
    if not upd.data:
        raise HTTPException(status_code=404, detail="Instructor not found")
    return {"hire_date": body.hire_date}


# ══════════════════════════════════════════════════════════════════════════════
# NEW ENDPOINTS — STUDENT MANAGEMENT, JOIN LINKS, INVITES, RESOURCES
# ══════════════════════════════════════════════════════════════════════════════

# ── New Pydantic models ───────────────────────────────────────────────────────

class AddStudentRequest(BaseModel):
    student_id: int


class InviteRequest(BaseModel):
    student_id: int
    message: Optional[str] = Field(default=None, max_length=500)


class ResourceUpdateRequest(BaseModel):
    title:        Optional[str]  = None
    description:  Optional[str]  = None
    is_published: Optional[bool] = None
    sort_order:   Optional[int]  = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _detect_resource_type(mime: str, ext: str, url: str = "") -> str:
    if "drive.google.com" in url or "docs.google.com" in url:
        return "drive_link"
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("video/"):
        return "video"
    if mime.startswith("audio/"):
        return "audio"
    if mime == "application/pdf" or ext == "pdf":
        return "pdf"
    if "presentation" in mime or ext in ("pptx", "ppt", "key", "odp"):
        return "presentation"
    if "word" in mime or "excel" in mime or ext in ("doc", "docx", "xls", "xlsx", "odt", "csv"):
        return "document"
    return "other"


def _assert_course_owner(manual_course_id: int, instructor_id: int) -> dict:
    course = (
        _supabase.table("manual_course")
        .select("*")
        .eq("manual_course_id", manual_course_id)
        .single()
        .execute()
    )
    if not course.data:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.data["instructor_id"] != instructor_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return course.data


# ── A. COURSE DETAIL ──────────────────────────────────────────────────────────

@router.get("/manual/{course_id}")
async def get_course_detail(course_id: int, authorization: Optional[str] = Header(default=None)):
    await _auth(authorization)
    course = (
        _supabase.table("manual_course")
        .select("*, instructor:instructor(first_name, last_name, employee_id, designation)")
        .eq("manual_course_id", course_id)
        .eq("is_active", True)
        .single()
        .execute()
    )
    if not course.data:
        raise HTTPException(status_code=404, detail="Course not found")

    enrollment_count = (
        _supabase.table("manual_enrollment")
        .select("enrollment_id", count="exact")
        .eq("manual_course_id", course_id)
        .eq("is_active", True)
        .execute()
    ).count or 0

    resource_count = (
        _supabase.table("course_resource")
        .select("resource_id", count="exact")
        .eq("manual_course_id", course_id)
        .eq("is_published", True)
        .execute()
    ).count or 0

    token = course.data.get("join_link_token", "")
    return {
        "course": course.data,
        "enrollment_count": enrollment_count,
        "resource_count": resource_count,
        "join_link": f"{FRONTEND_URL}/dashboard/classes?join={token}",
    }


# ── B. STUDENT MANAGEMENT ─────────────────────────────────────────────────────

@router.get("/manual/{course_id}/students/list")
async def list_course_students_with_email(
    course_id: int,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    instructor_id = _require_teacher(profile)
    _assert_course_owner(course_id, instructor_id)

    enrollments = (
        _supabase.table("manual_enrollment")
        .select("enrollment_id, enrolled_at, student_id, student:student(student_id, first_name, last_name, student_roll, profile_id)")
        .eq("manual_course_id", course_id)
        .eq("is_active", True)
        .execute()
    )

    students = []
    for e in (enrollments.data or []):
        s = e.get("student") or {}
        pid = s.get("profile_id")
        email = ""
        if pid:
            p = _supabase.table("profiles").select("id").eq("id", pid).maybe_single().execute()
            if p and p.data:
                auth_user = _supabase.auth.admin.get_user_by_id(pid)
                email = (auth_user.user.email or "") if auth_user and auth_user.user else ""
        students.append({
            "enrollment_id": e["enrollment_id"],
            "enrolled_at": e["enrolled_at"],
            "student_id": s.get("student_id"),
            "first_name": s.get("first_name"),
            "last_name": s.get("last_name"),
            "student_roll": s.get("student_roll"),
            "email": email,
        })

    return {"students": students, "total": len(students)}


@router.get("/students/all")
async def list_all_students(
    q: Optional[str] = Query(default=None),
    exclude_course_id: Optional[int] = Query(default=None),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0),
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    _require_teacher(profile)

    query = (
        _supabase.table("student")
        .select("student_id, first_name, last_name, student_roll, profile_id, program:program(program_name, program_code)")
        .eq("is_active", True)
    )
    if q:
        query = query.or_(
            f"first_name.ilike.%{q}%,last_name.ilike.%{q}%,student_roll.ilike.%{q}%"
        )

    res = query.range(offset, offset + limit - 1).execute()
    students = res.data or []

    # Exclude already-enrolled students if requested
    excluded_ids: set = set()
    if exclude_course_id:
        enrollments = (
            _supabase.table("manual_enrollment")
            .select("student_id")
            .eq("manual_course_id", exclude_course_id)
            .eq("is_active", True)
            .execute()
        )
        excluded_ids = {e["student_id"] for e in (enrollments.data or [])}

    result = []
    for s in students:
        if s["student_id"] in excluded_ids:
            continue
        prog = s.get("program") or {}
        result.append({
            "student_id":   s["student_id"],
            "first_name":   s["first_name"],
            "last_name":    s["last_name"],
            "student_roll": s["student_roll"],
            "program_name": prog.get("program_name"),
            "program_code": prog.get("program_code"),
        })

    return {"students": result, "total": len(result)}


@router.post("/manual/{course_id}/students/add", status_code=201)
async def add_student_to_course(
    course_id: int,
    body: AddStudentRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    instructor_id = _require_teacher(profile)
    _assert_course_owner(course_id, instructor_id)

    existing = (
        _supabase.table("manual_enrollment")
        .select("enrollment_id, is_active")
        .eq("manual_course_id", course_id)
        .eq("student_id", body.student_id)
        .maybe_single()
        .execute()
    )
    if existing and existing.data:
        if existing.data["is_active"]:
            raise HTTPException(status_code=409, detail="Student already enrolled")
        # Re-activate if previously removed
        _supabase.table("manual_enrollment").update({"is_active": True}).eq(
            "manual_course_id", course_id
        ).eq("student_id", body.student_id).execute()
    else:
        _supabase.table("manual_enrollment").insert({
            "manual_course_id": course_id,
            "student_id": body.student_id,
        }).execute()

    student = (
        _supabase.table("student")
        .select("student_id, first_name, last_name, student_roll")
        .eq("student_id", body.student_id)
        .single()
        .execute()
    )
    return {"enrolled": True, "student": student.data}


@router.delete("/manual/{course_id}/students/{student_id}", status_code=204)
async def remove_student_from_course(
    course_id: int,
    student_id: int,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    instructor_id = _require_teacher(profile)
    _assert_course_owner(course_id, instructor_id)

    _supabase.table("manual_enrollment").update({"is_active": False}).eq(
        "manual_course_id", course_id
    ).eq("student_id", student_id).execute()


# ── C. JOIN-BY-TOKEN ENDPOINTS ────────────────────────────────────────────────

@router.get("/join/{join_token}")
async def preview_join_by_token(
    join_token: str,
    authorization: Optional[str] = Header(default=None),
):
    await _auth(authorization)
    course = (
        _supabase.table("manual_course")
        .select("manual_course_id, course_name, course_code, description, credit_hours, semester, academic_year, enroll_code, join_link_token, instructor:instructor(first_name, last_name, designation)")
        .eq("join_link_token", join_token)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    if not course or not course.data:
        raise HTTPException(status_code=404, detail="Course not found or inactive")
    instr = course.data.get("instructor") or {}
    return {
        **course.data,
        "instructor_name": f"{instr.get('first_name', '')} {instr.get('last_name', '')}".strip(),
    }


@router.post("/join/{join_token}")
async def join_by_token(
    join_token: str,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    student_id = _require_student(profile)

    course = (
        _supabase.table("manual_course")
        .select("manual_course_id, course_name")
        .eq("join_link_token", join_token)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    if not course or not course.data:
        raise HTTPException(status_code=404, detail="Course not found or inactive")

    course_id = course.data["manual_course_id"]

    existing = (
        _supabase.table("manual_enrollment")
        .select("enrollment_id, is_active")
        .eq("manual_course_id", course_id)
        .eq("student_id", student_id)
        .maybe_single()
        .execute()
    )
    if existing and existing.data and existing.data["is_active"]:
        raise HTTPException(status_code=409, detail="Already enrolled")
    elif existing and existing.data:
        _supabase.table("manual_enrollment").update({"is_active": True}).eq(
            "manual_course_id", course_id
        ).eq("student_id", student_id).execute()
    else:
        _supabase.table("manual_enrollment").insert({
            "manual_course_id": course_id,
            "student_id": student_id,
        }).execute()

    # Mark any pending invite as accepted
    try:
        _supabase.table("course_invite").update({
            "status": "accepted",
            "responded_at": datetime.now(timezone.utc).isoformat(),
        }).eq("manual_course_id", course_id).eq("student_id", student_id).eq(
            "status", "pending"
        ).execute()
    except Exception:
        pass

    return {"enrolled": True, "course_name": course.data["course_name"], "course_id": course_id}


# ── D. INVITE ENDPOINTS ───────────────────────────────────────────────────────

@router.post("/manual/{course_id}/invite", status_code=201)
async def send_invite(
    course_id: int,
    body: InviteRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    instructor_id = _require_teacher(profile)
    course = _assert_course_owner(course_id, instructor_id)

    # Check not already enrolled
    existing = (
        _supabase.table("manual_enrollment")
        .select("enrollment_id")
        .eq("manual_course_id", course_id)
        .eq("student_id", body.student_id)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    if existing and existing.data:
        raise HTTPException(status_code=409, detail="Student already enrolled — no need to invite")

    res = _supabase.table("course_invite").upsert({
        "manual_course_id": course_id,
        "student_id":       body.student_id,
        "invited_by":       instructor_id,
        "status":           "pending",
        "message":          body.message,
        "sent_at":          datetime.now(timezone.utc).isoformat(),
        "responded_at":     None,
    }, on_conflict="manual_course_id,student_id").execute()

    invite_id = res.data[0]["invite_id"] if res.data else None

    # Notify the student
    try:
        student = _supabase.table("student").select("profile_id").eq("student_id", body.student_id).single().execute()
        if student.data:
            instr = _supabase.table("instructor").select("first_name, last_name").eq("instructor_id", instructor_id).single().execute()
            iname = ""
            if instr.data:
                iname = f"{instr.data['first_name']} {instr.data['last_name']}"
            _supabase.table("notification").insert({
                "recipient_id": student.data["profile_id"],
                "sender_id":    user.id,
                "notif_type":   "general",
                "title":        f"Class Invite: {course.get('course_name', 'Course')}",
                "body":         f"{iname} invited you to join {course.get('course_name', 'a course')}",
                "is_read":      False,
            }).execute()
    except Exception:
        pass

    return {"sent": True, "invite_id": invite_id}


@router.get("/invites/my")
async def get_my_invites(authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    student_id = _require_student(profile)

    res = (
        _supabase.table("course_invite")
        .select("*, course:manual_course(course_name, course_code, semester, join_link_token, instructor:instructor(first_name, last_name))")
        .eq("student_id", student_id)
        .eq("status", "pending")
        .order("sent_at", desc=True)
        .execute()
    )
    invites = []
    for row in (res.data or []):
        c = row.get("course") or {}
        instr = c.get("instructor") or {}
        invites.append({
            **{k: v for k, v in row.items() if k != "course"},
            "course_name":     c.get("course_name"),
            "course_code":     c.get("course_code"),
            "semester":        c.get("semester"),
            "join_link_token": c.get("join_link_token"),
            "instructor_name": f"{instr.get('first_name', '')} {instr.get('last_name', '')}".strip(),
        })
    return {"invites": invites}


@router.patch("/invites/{invite_id}/dismiss")
async def dismiss_invite(invite_id: int, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    student_id = _require_student(profile)

    _supabase.table("course_invite").update({
        "status": "dismissed",
        "responded_at": datetime.now(timezone.utc).isoformat(),
    }).eq("invite_id", invite_id).eq("student_id", student_id).execute()
    return {"dismissed": True}


# ── E. RESOURCE ENDPOINTS ─────────────────────────────────────────────────────

MAX_RESOURCE_BYTES = 2_147_483_648  # 2 GB


@router.post("/manual/{course_id}/resources/upload", status_code=201)
async def upload_resource(
    course_id: int,
    request: Request,
    file: Optional[UploadFile] = File(default=None),
    title: str = Form(""),
    description: Optional[str] = Form(None),
    resource_type: Optional[str] = Form(None),
    external_url: Optional[str] = Form(None),
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    instructor_id = _require_teacher(profile)
    _assert_course_owner(course_id, instructor_id)

    if not title.strip():
        raise HTTPException(status_code=400, detail="Title is required")

    if file and file.filename:
        # Check Content-Length before reading
        cl = request.headers.get("content-length")
        if cl and int(cl) > MAX_RESOURCE_BYTES:
            raise HTTPException(status_code=413, detail="File exceeds 2 GB limit")

        content = await file.read()
        if len(content) > MAX_RESOURCE_BYTES:
            raise HTTPException(status_code=413, detail="File exceeds 2 GB limit")

        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
        mime = file.content_type or "application/octet-stream"
        rtype = resource_type or _detect_resource_type(mime, ext)

        # Sanitise filename — spaces / parens cause 400s in Supabase Storage URLs
        safe_name = file.filename.replace(" ", "_").replace("(", "").replace(")", "")
        storage_path = f"{course_id}/{_uuid.uuid4()}/{safe_name}"

        # Ensure bucket exists (lifespan creation may have silently failed)
        try:
            _supabase.storage.create_bucket(
                "class-resources",
                options={"public": True, "file_size_limit": 52428800},
            )
        except Exception:
            pass  # already exists — that's fine

        _supabase.storage.from_("class-resources").upload(
            storage_path, content, {"content-type": mime}
        )
        file_url = _supabase.storage.from_("class-resources").get_public_url(storage_path)

        res = _supabase.table("course_resource").insert({
            "manual_course_id": course_id,
            "uploaded_by":      instructor_id,
            "title":            title.strip(),
            "description":      description,
            "resource_type":    rtype,
            "file_url":         file_url,
            "file_name":        file.filename or safe_name,
            "file_size_bytes":  len(content),
            "mime_type":        mime,
            "storage_path":     storage_path,
        }).execute()
        return res.data[0]

    elif external_url:
        rtype = resource_type or _detect_resource_type("", "", external_url)
        if rtype not in ("drive_link", "external_link"):
            rtype = "external_link"
        res = _supabase.table("course_resource").insert({
            "manual_course_id": course_id,
            "uploaded_by":      instructor_id,
            "title":            title.strip(),
            "description":      description,
            "resource_type":    rtype,
            "external_url":     external_url,
        }).execute()
        return res.data[0]

    raise HTTPException(status_code=400, detail="Either a file or external_url must be provided")


@router.get("/manual/{course_id}/resources")
async def get_course_resources(course_id: int, authorization: Optional[str] = Header(default=None)):
    user = await _auth(authorization)
    profile = _get_profile(user.id)

    # Verify access: teacher owns course OR student is enrolled
    if profile.get("role") == "teacher":
        instructor_id = _require_teacher(profile)
        _assert_course_owner(course_id, instructor_id)
    else:
        student_id = _require_student(profile)
        enrolled = (
            _supabase.table("manual_enrollment")
            .select("enrollment_id")
            .eq("manual_course_id", course_id)
            .eq("student_id", student_id)
            .eq("is_active", True)
            .maybe_single()
            .execute()
        )
        if not enrolled or not enrolled.data:
            raise HTTPException(status_code=403, detail="Not enrolled in this course")

    res = (
        _supabase.table("course_resource")
        .select("*")
        .eq("manual_course_id", course_id)
        .eq("is_published", True)
        .order("sort_order", desc=False)
        .order("uploaded_at", desc=True)
        .execute()
    )
    return {"resources": res.data or []}


@router.delete("/manual/{course_id}/resources/{resource_id}", status_code=204)
async def delete_resource(
    course_id: int,
    resource_id: int,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    instructor_id = _require_teacher(profile)
    _assert_course_owner(course_id, instructor_id)

    resource = (
        _supabase.table("course_resource")
        .select("storage_path")
        .eq("resource_id", resource_id)
        .eq("manual_course_id", course_id)
        .single()
        .execute()
    )
    if resource.data and resource.data.get("storage_path"):
        try:
            _supabase.storage.from_("class-resources").remove([resource.data["storage_path"]])
        except Exception:
            pass

    _supabase.table("course_resource").delete().eq("resource_id", resource_id).execute()


@router.patch("/manual/{course_id}/resources/{resource_id}")
async def update_resource(
    course_id: int,
    resource_id: int,
    body: ResourceUpdateRequest,
    authorization: Optional[str] = Header(default=None),
):
    user = await _auth(authorization)
    profile = _get_profile(user.id)
    instructor_id = _require_teacher(profile)
    _assert_course_owner(course_id, instructor_id)

    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    res = _supabase.table("course_resource").update(update_data).eq("resource_id", resource_id).eq("manual_course_id", course_id).execute()
    return res.data[0]
