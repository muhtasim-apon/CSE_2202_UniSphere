#!/usr/bin/env python3
"""
UniSphere / EduHub — seed_users.py

Connects to a Supabase project with the service_role key, GETs the existing
public profiles / students / instructors / manual_courses, and provisions the
missing auth.users for the 25 students + 5 teachers the seed depends on.

The trigger `public.handle_new_user()` (created in Database/authentication.sql)
auto-creates a matching `public.profiles` row for every `auth.users` insert,
so we only need to manage the typed (student, instructor) rows in `seed.sql`.

Outputs a JSON file with resolved UUIDs that the SQL seed reads via a PL/pgSQL
DO block (current_setting('seed.ids', ...)).

Usage:
    export SUPABASE_URL=https://xxx.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=eyJ...
    export SUPABASE_DB_URL=postgresql://postgres:...@db.xxx.supabase.co:5432/postgres

    python tools/seed.py --out /tmp/seed_ids.json
    psql "$SUPABASE_DB_URL" -v seed_ids_json="$(cat /tmp/seed_ids.json)" \
         -v ON_ERROR_STOP=1 -f Database/seed.sql
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional

try:
    from supabase import create_client, Client
except ImportError:
    sys.stderr.write(
        "ERROR: supabase-py is not installed.\n"
        "       Run: pip install supabase\n"
    )
    sys.exit(2)


# ---------------------------------------------------------------------------
# Demo dataset definition
# ---------------------------------------------------------------------------
# 5 teachers + 25 students. Names are intentionally fictional and obviously
# demo-flavoured, emails use @demo.eduhub so they're easy to spot in the DB.
# Roll numbers are digits-only to satisfy the `student_student_roll_check`
# constraint (`^[0-9]{4,20}$` after Database/fix_student_roll_format.sql).
# Employee IDs match `^EMP-[0-9]{3,6}$`.
# All phone numbers are in canonical BD form (`+8801XXXXXXXXX`) so the
# `normalise_phone_field` trigger is a no-op on insert.

DEMO_PASSWORD = "Demo1234!"   # noqa: S105 — public demo credential

TEACHERS: List[Dict[str, Any]] = [
    {
        "email": "teacher1@demo.eduhub",
        "first_name": "Rahim",
        "last_name": "Ahmed",
        "gender": "Male",
        "dob": "1985-03-12",
        "phone": "+8801711000001",
        "employee_id": "EMP-101",
        "designation": "Professor",
        "specialization": "Algorithms and Theory of Computation",
        "office_location": "CSE-401",
        "bio": "Senior professor with 15 years of research in graph algorithms and complexity theory.",
    },
    {
        "email": "teacher2@demo.eduhub",
        "first_name": "Karim",
        "last_name": "Hossain",
        "gender": "Male",
        "dob": "1988-07-22",
        "phone": "+8801711000002",
        "employee_id": "EMP-102",
        "designation": "Associate Professor",
        "specialization": "Machine Learning and Data Mining",
        "office_location": "CSE-307",
        "bio": "Associate professor working on deep learning, NLP, and large-scale data mining.",
    },
    {
        "email": "teacher3@demo.eduhub",
        "first_name": "Sumaiya",
        "last_name": "Khan",
        "gender": "Female",
        "dob": "1990-11-05",
        "phone": "+8801711000003",
        "employee_id": "EMP-103",
        "designation": "Assistant Professor",
        "specialization": "Computer Networks and Distributed Systems",
        "office_location": "CSE-215",
        "bio": "Assistant professor focusing on 5G networks, edge computing, and protocol design.",
    },
    {
        "email": "teacher4@demo.eduhub",
        "first_name": "Nazmul",
        "last_name": "Islam",
        "gender": "Male",
        "dob": "1982-01-30",
        "phone": "+8801711000004",
        "employee_id": "EMP-104",
        "designation": "Professor",
        "specialization": "Database Systems and Information Retrieval",
        "office_location": "CSE-510",
        "bio": "Professor and database group lead; published 40+ papers on indexing and query optimisation.",
    },
    {
        "email": "teacher5@demo.eduhub",
        "first_name": "Tania",
        "last_name": "Akter",
        "gender": "Female",
        "dob": "1992-05-18",
        "phone": "+8801711000005",
        "employee_id": "EMP-105",
        "designation": "Lecturer",
        "specialization": "Software Engineering and Human-Computer Interaction",
        "office_location": "CSE-118",
        "bio": "Lecturer teaching software design, UX research, and capstone project supervision.",
    },
]

STUDENTS: List[Dict[str, Any]] = [
    # 25 students — Bangladeshi first/last names, mix of bins for batch_year.
    {"email": "student1@demo.eduhub",  "first_name": "Arif",   "last_name": "Rahman",     "gender": "Male",   "dob": "2003-04-12", "phone": "+8801721000001", "roll": "2023715001", "batch_year": 2023, "current_semester": 5, "address": "Mirpur, Dhaka"},
    {"email": "student2@demo.eduhub",  "first_name": "Sadia",  "last_name": "Islam",      "gender": "Female", "dob": "2003-08-25", "phone": "+8801721000002", "roll": "2023715002", "batch_year": 2023, "current_semester": 5, "address": "Dhanmondi, Dhaka"},
    {"email": "student3@demo.eduhub",  "first_name": "Imran",  "last_name": "Hossain",    "gender": "Male",   "dob": "2002-12-02", "phone": "+8801721000003", "roll": "2023715003", "batch_year": 2023, "current_semester": 5, "address": "Uttara, Dhaka"},
    {"email": "student4@demo.eduhub",  "first_name": "Nusrat", "last_name": "Jahan",      "gender": "Female", "dob": "2003-02-14", "phone": "+8801721000004", "roll": "2023715004", "batch_year": 2023, "current_semester": 5, "address": "Mohammadpur, Dhaka"},
    {"email": "student5@demo.eduhub",  "first_name": "Tariq",  "last_name": "Aziz",       "gender": "Male",   "dob": "2003-06-30", "phone": "+8801721000005", "roll": "2023715005", "batch_year": 2023, "current_semester": 5, "address": "Banani, Dhaka"},
    {"email": "student6@demo.eduhub",  "first_name": "Mehnaz", "last_name": "Tabassum",   "gender": "Female", "dob": "2003-09-09", "phone": "+8801721000006", "roll": "2023715006", "batch_year": 2023, "current_semester": 5, "address": "Bashundhara, Dhaka"},
    {"email": "student7@demo.eduhub",  "first_name": "Faisal", "last_name": "Khan",       "gender": "Male",   "dob": "2004-01-17", "phone": "+8801721000007", "roll": "2023715007", "batch_year": 2023, "current_semester": 3, "address": "Gulshan, Dhaka"},
    {"email": "student8@demo.eduhub",  "first_name": "Rifat",  "last_name": "Chowdhury",  "gender": "Male",   "dob": "2004-03-21", "phone": "+8801721000008", "roll": "2023715008", "batch_year": 2023, "current_semester": 3, "address": "Malibagh, Dhaka"},
    {"email": "student9@demo.eduhub",  "first_name": "Sharmin","last_name": "Akter",      "gender": "Female", "dob": "2004-05-04", "phone": "+8801721000009", "roll": "2023715009", "batch_year": 2023, "current_semester": 3, "address": "Lalmatia, Dhaka"},
    {"email": "student10@demo.eduhub", "first_name": "Sabbir", "last_name": "Hossain",    "gender": "Male",   "dob": "2004-07-19", "phone": "+8801721000010", "roll": "2023715010", "batch_year": 2023, "current_semester": 3, "address": "Khilgaon, Dhaka"},
    {"email": "student11@demo.eduhub", "first_name": "Mst",    "last_name": "Ayesha",     "gender": "Female", "dob": "2002-10-08", "phone": "+8801721000011", "roll": "2022715011", "batch_year": 2022, "current_semester": 7, "address": "Mirpur, Dhaka"},
    {"email": "student12@demo.eduhub", "first_name": "Rakib",  "last_name": "Hasan",      "gender": "Male",   "dob": "2002-02-28", "phone": "+8801721000012", "roll": "2022715012", "batch_year": 2022, "current_semester": 7, "address": "Mohammadpur, Dhaka"},
    {"email": "student13@demo.eduhub", "first_name": "Tasnim", "last_name": "Nahar",      "gender": "Female", "dob": "2002-06-13", "phone": "+8801721000013", "roll": "2022715013", "batch_year": 2022, "current_semester": 7, "address": "Dhanmondi, Dhaka"},
    {"email": "student14@demo.eduhub", "first_name": "Jamil",  "last_name": "Uddin",      "gender": "Male",   "dob": "2002-04-25", "phone": "+8801721000014", "roll": "2022715014", "batch_year": 2022, "current_semester": 7, "address": "Uttara, Dhaka"},
    {"email": "student15@demo.eduhub", "first_name": "Lamisa", "last_name": "Khan",       "gender": "Female", "dob": "2002-11-30", "phone": "+8801721000015", "roll": "2022715015", "batch_year": 2022, "current_semester": 7, "address": "Banani, Dhaka"},
    {"email": "student16@demo.eduhub", "first_name": "Nadim",  "last_name": "Rahman",     "gender": "Male",   "dob": "2001-08-11", "phone": "+8801721000016", "roll": "2021715016", "batch_year": 2021, "current_semester": 7, "address": "Bashundhara, Dhaka"},
    {"email": "student17@demo.eduhub", "first_name": "Rohima", "last_name": "Begum",      "gender": "Female", "dob": "2003-12-07", "phone": "+8801721000017", "roll": "2023715017", "batch_year": 2023, "current_semester": 5, "address": "Gulshan, Dhaka"},
    {"email": "student18@demo.eduhub", "first_name": "Hasib",  "last_name": "Ahmed",      "gender": "Male",   "dob": "2003-11-23", "phone": "+8801721000018", "roll": "2023715018", "batch_year": 2023, "current_semester": 5, "address": "Malibagh, Dhaka"},
    {"email": "student19@demo.eduhub", "first_name": "Priya",  "last_name": "Das",        "gender": "Female", "dob": "2004-02-09", "phone": "+8801721000019", "roll": "2023715019", "batch_year": 2023, "current_semester": 3, "address": "Lalmatia, Dhaka"},
    {"email": "student20@demo.eduhub", "first_name": "Shuvo",  "last_name": "Sarkar",     "gender": "Male",   "dob": "2004-04-16", "phone": "+8801721000020", "roll": "2023715020", "batch_year": 2023, "current_semester": 3, "address": "Khilgaon, Dhaka"},
    {"email": "student21@demo.eduhub", "first_name": "Mim",    "last_name": "Akter",      "gender": "Female", "dob": "2002-09-02", "phone": "+8801721000021", "roll": "2022715021", "batch_year": 2022, "current_semester": 7, "address": "Mirpur, Dhaka"},
    {"email": "student22@demo.eduhub", "first_name": "Rashed", "last_name": "Mahmud",     "gender": "Male",   "dob": "2002-05-20", "phone": "+8801721000022", "roll": "2022715022", "batch_year": 2022, "current_semester": 7, "address": "Mohammadpur, Dhaka"},
    {"email": "student23@demo.eduhub", "first_name": "Anika",  "last_name": "Tasnim",     "gender": "Female", "dob": "2002-07-14", "phone": "+8801721000023", "roll": "2022715023", "batch_year": 2022, "current_semester": 7, "address": "Dhanmondi, Dhaka"},
    {"email": "student24@demo.eduhub", "first_name": "Sadman", "last_name": "Sakib",      "gender": "Male",   "dob": "2003-10-26", "phone": "+8801721000024", "roll": "2023715024", "batch_year": 2023, "current_semester": 5, "address": "Uttara, Dhaka"},
    {"email": "student25@demo.eduhub", "first_name": "Afsana", "last_name": "Mim",        "gender": "Female", "dob": "2003-01-08", "phone": "+8801721000025", "roll": "2023715025", "batch_year": 2023, "current_semester": 5, "address": "Banani, Dhaka"},
]


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def get_client() -> "Client":
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.stderr.write(
            "ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n"
        )
        sys.exit(2)
    return create_client(url, key)


def fetch_existing_profiles(supabase: "Client") -> Dict[str, Dict[str, Any]]:
    """Return {email: {id, role, ...}} joined via auth.users (admin API)."""
    out: Dict[str, Dict[str, Any]] = {}
    try:
        # List auth users (paginated; max ~50/page). Supabase admin.list_users() returns
        # users with .email and .id. We then pull the profile row for the role.
        page = 1
        per_page = 200
        while True:
            resp = supabase.auth.admin.list_users(page=page, per_page=per_page)
            users = getattr(resp, "users", []) or []
            if not users:
                break
            for u in users:
                email = (u.email or "").lower()
                if email:
                    out[email] = {"uid": str(u.id), "email": email}
            if len(users) < per_page:
                break
            page += 1
    except Exception as exc:  # pragma: no cover — defensive
        sys.stderr.write(f"WARN: list_users failed: {exc}\n")

    # Enrich with role from profiles (the trigger sets it from raw_user_meta_data).
    if out:
        try:
            prof_resp = (
                supabase.table("profiles")
                .select("id,role,first_name,last_name,phone,student_id,instructor_id")
                .in_("id", [v["uid"] for v in out.values()])
                .execute()
            )
            for row in (prof_resp.data or []):
                uid = row.get("id")
                for v in out.values():
                    if v["uid"] == uid:
                        v.update(
                            {
                                "role": row.get("role"),
                                "first_name": row.get("first_name"),
                                "last_name": row.get("last_name"),
                                "phone": row.get("phone"),
                                "student_id": row.get("student_id"),
                                "instructor_id": row.get("instructor_id"),
                            }
                        )
                        break
        except Exception as exc:  # pragma: no cover
            sys.stderr.write(f"WARN: profiles fetch failed: {exc}\n")

    return out


def fetch_existing_students(supabase: "Client") -> Dict[str, Dict[str, Any]]:
    """{student_roll: {student_id, profile_id, ...}}"""
    resp = (
        supabase.table("student")
        .select("student_id,profile_id,student_roll,first_name,last_name,phone,program_id,batch_year,current_semester,cgpa,total_credits,date_of_birth,gender,address,emergency_contact_name,emergency_contact_phone,is_active")
        .execute()
    )
    return {row["student_roll"]: row for row in (resp.data or [])}


def fetch_existing_instructors(supabase: "Client") -> Dict[str, Dict[str, Any]]:
    """{employee_id: {instructor_id, profile_id, ...}}"""
    resp = (
        supabase.table("instructor")
        .select("instructor_id,profile_id,employee_id,first_name,last_name,phone,dept_id,gender,date_of_birth,designation,specialization,office_location,bio,hire_date,is_active")
        .execute()
    )
    return {row["employee_id"]: row for row in (resp.data or [])}


def fetch_existing_courses(supabase: "Client") -> List[Dict[str, Any]]:
    resp = (
        supabase.table("manual_course")
        .select("manual_course_id,instructor_id,dept_id,course_name,course_code,credit_hours,enroll_code,semester,academic_year,semester_number,is_active,join_link_token,description")
        .execute()
    )
    return list(resp.data or [])


def fetch_existing_departments(supabase: "Client") -> Dict[str, Dict[str, Any]]:
    resp = supabase.table("department").select("dept_id,dept_name,dept_code").execute()
    return {row["dept_code"]: row for row in (resp.data or [])}


def fetch_existing_programs(supabase: "Client") -> Dict[str, Dict[str, Any]]:
    resp = supabase.table("program").select("program_id,dept_id,program_name,program_code,degree_level").execute()
    return {row["program_code"]: row for row in (resp.data or [])}


def create_auth_user(
    supabase: "Client",
    email: str,
    role: str,
    first_name: str,
    last_name: str,
    phone: Optional[str] = None,
) -> str:
    """Provision an auth.users row; the handle_new_user() trigger creates the profile."""
    user_metadata = {
        "role": role,
        "first_name": first_name,
        "last_name": last_name,
    }
    if phone:
        user_metadata["phone"] = phone

    try:
        user = supabase.auth.admin.create_user(
            {
                "email": email,
                "password": DEMO_PASSWORD,
                "email_confirm": True,
                "user_metadata": user_metadata,
            }
        )
        # supabase-py v2.x returns a User object with .id
        return str(user.user.id)
    except Exception as exc:
        # The user may already exist but wasn't returned by list_users due to pagination.
        # Re-list to find it.
        sys.stderr.write(f"  ! create_user({email}) failed: {exc}\n")
        existing = fetch_existing_profiles(supabase)
        if email in existing:
            return existing[email]["uid"]
        raise


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default="/tmp/seed_ids.json", help="Output JSON path")
    parser.add_argument("--supabase-url", default=os.environ.get("SUPABASE_URL"))
    parser.add_argument("--service-key", default=os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))
    parser.add_argument("--skip-create", action="store_true", help="Don't create users; only fetch existing IDs")
    args = parser.parse_args()

    if args.supabase_url:
        os.environ["SUPABASE_URL"] = args.supabase_url
    if args.service_key:
        os.environ["SUPABASE_SERVICE_ROLE_KEY"] = args.service_key

    supabase = get_client()

    sys.stderr.write("→ Fetching existing profiles (admin.list_users)…\n")
    existing_profiles = fetch_existing_profiles(supabase)

    sys.stderr.write("→ Fetching existing students…\n")
    existing_students = fetch_existing_students(supabase)

    sys.stderr.write("→ Fetching existing instructors…\n")
    existing_instructors = fetch_existing_instructors(supabase)

    sys.stderr.write("→ Fetching existing manual_courses…\n")
    existing_courses = fetch_existing_courses(supabase)

    sys.stderr.write("→ Fetching existing departments/programs…\n")
    existing_departments = fetch_existing_departments(supabase)
    existing_programs = fetch_existing_programs(supabase)

    # ------------------------------------------------------------------
    # 1. Resolve / create teacher auth.users
    # ------------------------------------------------------------------
    teacher_records: List[Dict[str, Any]] = []
    for t in TEACHERS:
        email = t["email"].lower()
        if email in existing_profiles:
            uid = existing_profiles[email]["uid"]
            sys.stderr.write(f"  ✓ teacher exists: {email} ({uid})\n")
        else:
            if args.skip_create:
                sys.stderr.write(f"  ✗ teacher missing: {email} (skip-create)\n")
                continue
            sys.stderr.write(f"  + creating teacher: {email}\n")
            uid = create_auth_user(
                supabase=supabase,
                email=email,
                role="teacher",
                first_name=t["first_name"],
                last_name=t["last_name"],
                phone=t["phone"],
            )
            # Sometimes the trigger is async; nudge it.
            time.sleep(0.2)
        emp_id = t.get("employee_id")
        instr = existing_instructors.get(emp_id)
        existing_codes = []
        if instr:
            existing_codes = [
                c["enroll_code"]
                for c in existing_courses
                if c.get("instructor_id") == instr.get("instructor_id")
            ]
        teacher_records.append({**t, "uid": uid, "existing_enroll_codes": existing_codes})

    # ------------------------------------------------------------------
    # 2. Resolve / create student auth.users
    # ------------------------------------------------------------------
    student_records: List[Dict[str, Any]] = []
    for s in STUDENTS:
        email = s["email"].lower()
        if email in existing_profiles:
            uid = existing_profiles[email]["uid"]
            sys.stderr.write(f"  ✓ student exists: {email} ({uid})\n")
        else:
            if args.skip_create:
                sys.stderr.write(f"  ✗ student missing: {email} (skip-create)\n")
                continue
            sys.stderr.write(f"  + creating student: {email}\n")
            uid = create_auth_user(
                supabase=supabase,
                email=email,
                role="student",
                first_name=s["first_name"],
                last_name=s["last_name"],
                phone=s["phone"],
            )
            time.sleep(0.2)
        student_records.append({**s, "uid": uid})

    # ------------------------------------------------------------------
    # 3. Emit JSON for the SQL file
    # ------------------------------------------------------------------
    payload = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "demo_password": DEMO_PASSWORD,
        "teachers": teacher_records,
        "students": student_records,
        "courses_existing": existing_courses,
        "departments_existing": list(existing_departments.values()),
        "programs_existing": list(existing_programs.values()),
        "students_existing": list(existing_students.values()),
        "instructors_existing": list(existing_instructors.values()),
    }

    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)

    sys.stderr.write(f"\n✓ Wrote {args.out} ({len(teacher_records)} teachers, {len(student_records)} students)\n")
    sys.stderr.write("  Run the SQL seed with:\n")
    sys.stderr.write(
        f"    psql \"$SUPABASE_DB_URL\" -v seed_ids_json=\"$(cat {args.out})\" \\\n"
        "         -v ON_ERROR_STOP=1 -f Database/seed.sql\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
