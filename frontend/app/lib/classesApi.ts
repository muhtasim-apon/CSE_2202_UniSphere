import { API_BASE } from '@/app/lib/apiBase'

const BASE = API_BASE

// ── Types ──────────────────────────────────────────────────────────────────

export interface ManualCourse {
  manual_course_id: number
  instructor_id: number
  course_name: string
  course_code: string | null
  description: string | null
  credit_hours: number
  enroll_code: string
  semester: string | null
  academic_year: string | null
  semester_number: number | null
  is_active: boolean
  created_at: string
  enrollment_count?: number
  instructor?: { first_name: string; last_name: string }
}

export interface AttendanceSession {
  session_id: number
  manual_course_id: number
  instructor_id: number
  session_date: string
  session_title: string | null
  topic: string | null
  notes: string | null
  created_at: string
}

export interface AttendanceRecord {
  record_id: number
  session_id: number
  student_id: number
  status: 'Present' | 'Absent' | 'Late' | 'Excused'
  remarks: string | null
  marked_at: string
  student?: { first_name: string; last_name: string; student_roll: string }
}

export interface Exam {
  exam_id: number
  manual_course_id: number | null
  exam_name: string
  exam_type: string
  total_marks: number
  credit_hours: number
  exam_date: string | null
  semester: string | null
  is_published: boolean
  created_by: string
  created_at: string
  my_mark?: ExamMark | null
}

export interface ExamMark {
  mark_id: number
  exam_id: number
  student_id: number
  marks_obtained: number
  grade: string | null
  grade_points: number | null
  remarks: string | null
  entered_at: string
}

/** One curriculum mark head (§18.4) and its contribution to the course total. */
export interface MarkHead {
  head: string
  weight: number
  obtained: number | null
  total: number | null
  contribution: number | null
}

/** A course graded once out of 100 (§18.8) — not a single exam. */
export interface CourseResult {
  course_id: number
  course_name: string | null
  course_code: string | null
  course_type: 'theory' | 'lab'
  credit_hours: number
  semester: string | null
  semester_number: number | null
  course_pct: number
  grade: string
  grade_points: number
  is_complete: boolean
  heads: MarkHead[]
}

export interface SemesterResult {
  semester_number: number | null
  sgpa: number
  credits: number
  courses: CourseResult[]
}

export interface IncompleteCourse {
  course_id: number
  course_name: string | null
  course_code: string | null
  credit_hours: number
  provisional_pct: number
  heads: MarkHead[]
}

export interface CGPAResult {
  cgpa: number
  total_credits_earned: number
  total_credits_attempted: number
  total_points: number
  course_count: number
  f_grade_count: number
  semesters: SemesterResult[]
  incomplete_courses: IncompleteCourse[]
  /** @deprecated alias for total_credits_earned */
  total_credits: number
}

/** Curriculum §18.4 display labels for each mark head. */
export const MARK_HEAD_LABELS: Record<string, string> = {
  participation: 'Class Participation',
  class_test:    'Class Test (best 1 of 2)',
  assignment:    'Assignment / Presentation',
  midterm:       'Midterm Examination',
  final:         'Semester Final',
  continuous:    'Continuous Lab Performance',
  reports:       'Lab Reports',
  viva:          'Lab Viva-Voce',
  capstone:      'Capstone / Demo',
}

/** Degree requirements (curriculum §7h, §7i). */
export const REQUIRED_CREDITS = 150
export const MIN_GRADUATION_CGPA = 2.0

/** Final-exam eligibility bands (§18.6). */
export type AttendanceBand = 'eligible' | 'fined' | 'barred'

export function attendanceBand(pct: number): AttendanceBand {
  if (pct >= 75) return 'eligible'
  if (pct >= 60) return 'fined'
  return 'barred'
}

export const ATTENDANCE_BAND_LABEL: Record<AttendanceBand, string> = {
  eligible: 'Eligible for final exam',
  fined:    'Eligible with fine (below 75%)',
  barred:   'Not eligible — below 60%',
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
    throw new Error('Backend not reachable. Run: cd backend && uvicorn main:app --reload --port 8000')
  }
  if (!res.ok) {
    let detail = ''
    try { const j = await res.json(); detail = j?.detail ?? JSON.stringify(j) } catch { detail = '' }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return res
}

// ── Manual Courses ─────────────────────────────────────────────────────────

export async function createManualCourse(token: string, data: {
  course_name: string; course_code?: string; description?: string
  credit_hours?: number; enroll_code?: string; semester?: string; academic_year?: string
  semester_number?: number | null
}): Promise<ManualCourse> {
  return (await apiFetch(`${BASE}/api/classes/manual/create`, { method: 'POST', headers: authHeader(token), body: JSON.stringify(data) })).json()
}

export async function joinManualCourse(token: string, enroll_code: string): Promise<{ enrollment: object; course: ManualCourse }> {
  return (await apiFetch(`${BASE}/api/classes/manual/join`, { method: 'POST', headers: authHeader(token), body: JSON.stringify({ enroll_code }) })).json()
}

export async function getManualCourses(token: string): Promise<{ courses: ManualCourse[] }> {
  return (await apiFetch(`${BASE}/api/classes/manual`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

export async function deleteManualCourse(token: string, id: number): Promise<void> {
  await apiFetch(`${BASE}/api/classes/manual/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
}

// ── Attendance ──────────────────────────────────────────────────────────────

export async function createAttendanceSession(token: string, data: {
  manual_course_id: number; session_date?: string; session_title?: string; topic?: string; notes?: string
}): Promise<{ session: AttendanceSession; records: AttendanceRecord[] }> {
  return (await apiFetch(`${BASE}/api/classes/attendance/session`, { method: 'POST', headers: authHeader(token), body: JSON.stringify(data) })).json()
}

export async function updateAttendanceRecord(token: string, sessionId: number, studentId: number, status: string, remarks?: string): Promise<AttendanceRecord> {
  return (await apiFetch(`${BASE}/api/classes/attendance/session/${sessionId}/record/${studentId}`, { method: 'PATCH', headers: authHeader(token), body: JSON.stringify({ status, remarks }) })).json()
}

export async function getAttendanceSession(token: string, sessionId: number): Promise<{ session: AttendanceSession; records: AttendanceRecord[]; summary: object }> {
  return (await apiFetch(`${BASE}/api/classes/attendance/session/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

export async function getMyAttendanceSummary(token: string): Promise<{ summary: object[] }> {
  return (await apiFetch(`${BASE}/api/classes/attendance/my-summary`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

export async function getCourseAttendance(token: string, courseId: number): Promise<{ sessions: AttendanceSession[] }> {
  return (await apiFetch(`${BASE}/api/classes/attendance/course/${courseId}`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

// ── Exams ──────────────────────────────────────────────────────────────────

export async function createExam(token: string, data: {
  manual_course_id?: number; exam_name: string; exam_type?: string
  total_marks: number; credit_hours?: number; exam_date?: string
  semester?: string; academic_year?: string; description?: string
}): Promise<Exam> {
  return (await apiFetch(`${BASE}/api/classes/exams`, { method: 'POST', headers: authHeader(token), body: JSON.stringify(data) })).json()
}

export async function getExams(token: string): Promise<{ exams: Exam[] }> {
  return (await apiFetch(`${BASE}/api/classes/exams`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

export async function getExamsByCourse(token: string, courseId: number): Promise<{ exams: Exam[] }> {
  return (await apiFetch(`${BASE}/api/classes/exams?course_id=${courseId}`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

export async function upsertMark(token: string, examId: number, studentId: number, marksObtained: number, remarks?: string): Promise<ExamMark> {
  return (await apiFetch(`${BASE}/api/classes/exams/${examId}/marks/${studentId}`, { method: 'PUT', headers: authHeader(token), body: JSON.stringify({ marks_obtained: marksObtained, remarks }) })).json()
}

export async function getExamMarks(token: string, examId: number): Promise<{ marks?: ExamMark[]; mark?: ExamMark | null }> {
  return (await apiFetch(`${BASE}/api/classes/exams/${examId}/marks`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

// ── CGPA ───────────────────────────────────────────────────────────────────

export async function getCGPA(token: string): Promise<CGPAResult> {
  return (await apiFetch(`${BASE}/api/classes/cgpa`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

export async function recalculateCGPA(token: string): Promise<CGPAResult & { new_cgpa: number; previous_cgpa: number; changed: boolean }> {
  return (await apiFetch(`${BASE}/api/classes/cgpa/recalculate`, { method: 'POST', headers: authHeader(token) })).json()
}

// ── New types ──────────────────────────────────────────────────────────────

export interface CourseInvite {
  invite_id: number
  manual_course_id: number
  student_id: number
  invited_by: number
  status: 'pending' | 'accepted' | 'dismissed'
  message: string | null
  sent_at: string
  responded_at: string | null
  course_name: string
  course_code: string | null
  semester: string | null
  instructor_name: string
  join_link_token: string
}

export interface CourseResource {
  resource_id: number
  manual_course_id: number
  uploaded_by: number
  title: string
  description: string | null
  resource_type: 'pdf' | 'image' | 'video' | 'audio' | 'document' | 'presentation' | 'drive_link' | 'external_link' | 'other'
  file_url: string | null
  file_name: string | null
  file_size_bytes: number | null
  mime_type: string | null
  storage_path: string | null
  external_url: string | null
  is_published: boolean
  sort_order: number
  download_count: number
  uploaded_at: string
}

export interface CourseStudent {
  enrollment_id: number
  student_id: number
  first_name: string
  last_name: string
  student_roll: string
  email: string
  enrolled_at: string
}

export interface AllStudent {
  student_id: number
  first_name: string
  last_name: string
  student_roll: string
  program_name: string | null
  program_code: string | null
}

// ── Student management ─────────────────────────────────────────────────────

export async function getCourseStudents(token: string, courseId: number): Promise<{ students: CourseStudent[]; total: number }> {
  return (await apiFetch(`${BASE}/api/classes/manual/${courseId}/students/list`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

export async function getAllStudents(token: string, q?: string, excludeCourseId?: number): Promise<{ students: AllStudent[]; total: number }> {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (excludeCourseId) params.set('exclude_course_id', String(excludeCourseId))
  return (await apiFetch(`${BASE}/api/classes/students/all?${params}`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

export async function addStudentToCourse(token: string, courseId: number, studentId: number): Promise<{ enrolled: boolean; student: AllStudent }> {
  return (await apiFetch(`${BASE}/api/classes/manual/${courseId}/students/add`, { method: 'POST', headers: authHeader(token), body: JSON.stringify({ student_id: studentId }) })).json()
}

export async function removeStudentFromCourse(token: string, courseId: number, studentId: number): Promise<void> {
  await apiFetch(`${BASE}/api/classes/manual/${courseId}/students/${studentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
}

// ── Invites ────────────────────────────────────────────────────────────────

export async function sendInvite(token: string, courseId: number, studentId: number, message?: string): Promise<{ sent: boolean; invite_id: number }> {
  return (await apiFetch(`${BASE}/api/classes/manual/${courseId}/invite`, { method: 'POST', headers: authHeader(token), body: JSON.stringify({ student_id: studentId, message: message ?? null }) })).json()
}

export async function getMyInvites(token: string): Promise<{ invites: CourseInvite[] }> {
  return (await apiFetch(`${BASE}/api/classes/invites/my`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

export async function dismissInvite(token: string, inviteId: number): Promise<{ dismissed: boolean }> {
  return (await apiFetch(`${BASE}/api/classes/invites/${inviteId}/dismiss`, { method: 'PATCH', headers: authHeader(token) })).json()
}

// ── Join by token ──────────────────────────────────────────────────────────

export async function getCourseByJoinToken(token: string, joinToken: string): Promise<object> {
  return (await apiFetch(`${BASE}/api/classes/join/${joinToken}`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

export async function joinByToken(token: string, joinToken: string): Promise<{ enrolled: boolean; course_name: string; course_id: number }> {
  return (await apiFetch(`${BASE}/api/classes/join/${joinToken}`, { method: 'POST', headers: authHeader(token) })).json()
}

// ── Resources ──────────────────────────────────────────────────────────────

export function uploadResource(token: string, courseId: number, formData: FormData, onProgress?: (pct: number) => void): Promise<CourseResource> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)) } catch { reject(new Error('Invalid response')) }
      } else {
        try { const j = JSON.parse(xhr.responseText); reject(new Error(j?.detail ?? `HTTP ${xhr.status}`)) }
        catch { reject(new Error(`HTTP ${xhr.status}`)) }
      }
    })
    xhr.addEventListener('error', () => reject(new Error('Network error')))
    xhr.open('POST', `${BASE}/api/classes/manual/${courseId}/resources/upload`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.send(formData)
  })
}

export async function getCourseResources(token: string, courseId: number): Promise<{ resources: CourseResource[] }> {
  return (await apiFetch(`${BASE}/api/classes/manual/${courseId}/resources`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

export async function deleteResource(token: string, courseId: number, resourceId: number): Promise<void> {
  await apiFetch(`${BASE}/api/classes/manual/${courseId}/resources/${resourceId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
}

export async function getCourseDetail(token: string, courseId: number): Promise<object> {
  return (await apiFetch(`${BASE}/api/classes/manual/${courseId}`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

// ── Hire date (instructor) ─────────────────────────────────────────────────

export async function updateHireDate(token: string, hire_date: string): Promise<{ hire_date: string }> {
  return (await apiFetch(`${BASE}/api/profile/hire-date`, { method: 'PATCH', headers: authHeader(token), body: JSON.stringify({ hire_date }) })).json()
}

// ── New Attendance/Exam detail types ───────────────────────────────────────

export interface SessionWithRecords extends AttendanceSession {
  records: AttendanceRecord[]
  summary: { present: number; absent: number; late: number; excused: number; total: number }
}

export interface StudentAttendanceCourse {
  course_id: number
  course_name: string
  course_code: string | null
  semester: string | null
  total_sessions: number
  present: number
  absent: number
  late: number
  excused: number
  attendance_pct: number
  sessions: {
    session_id: number
    session_date: string
    session_title: string | null
    topic: string | null
    status: 'Present' | 'Absent' | 'Late' | 'Excused' | null
    remarks: string | null
  }[]
}

export interface GradebookExam {
  exam_id: number
  exam_name: string
  exam_type: string
  total_marks: number
  credit_hours: number
  exam_date: string | null
}

export interface GradebookStudent {
  student_id: number
  first_name: string
  last_name: string
  student_roll: string
  marks: Record<number, { mark_id: number; marks_obtained: number; grade: string | null; grade_points: number | null; remarks: string | null }>
}

export interface StudentMarkEntry {
  exam_id: number
  exam_name: string
  exam_type: string
  total_marks: number
  credit_hours: number
  exam_date: string | null
  marks_obtained: number
  grade: string | null
  grade_points: number | null
  remarks: string | null
}

export interface StudentMarksCourse {
  course_id: number
  course_name: string
  course_code: string | null
  semester: string | null
  by_type: Record<string, StudentMarkEntry[]>
}

// ── New API functions ──────────────────────────────────────────────────────

export async function getCourseAttendanceFull(token: string, courseId: number): Promise<{ sessions: SessionWithRecords[] }> {
  return (await apiFetch(`${BASE}/api/classes/attendance/course/${courseId}/full`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

export async function getMyAttendanceDetail(token: string): Promise<{ courses: StudentAttendanceCourse[] }> {
  return (await apiFetch(`${BASE}/api/classes/attendance/my-detail`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

export async function getCourseGradebook(token: string, courseId: number): Promise<{ exams: GradebookExam[]; students: GradebookStudent[] }> {
  return (await apiFetch(`${BASE}/api/classes/exams/course/${courseId}/gradebook`, { headers: { Authorization: `Bearer ${token}` } })).json()
}

export async function getMyAllMarks(token: string): Promise<{ courses: StudentMarksCourse[] }> {
  return (await apiFetch(`${BASE}/api/classes/exams/my-marks`, { headers: { Authorization: `Bearer ${token}` } })).json()
}
