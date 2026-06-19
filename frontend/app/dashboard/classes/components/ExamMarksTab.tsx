'use client'

import { useState, useEffect } from 'react'
import { Plus, FileText, ChevronDown, ChevronUp, Info, Save } from 'lucide-react'
import {
  getExams, createExam, upsertMark,
  getManualCourses, getExamMarks, getCourseStudents,
  type Exam, type ExamMark, type ManualCourse, type CourseStudent,
} from '@/app/lib/classesApi'

type Props = {
  token: string
  role: 'teacher' | 'student'
  userId: string
}

const EXAM_TYPES = ['Midterm', 'Final', 'Quiz', 'Assignment', 'Lab', 'Viva', 'Presentation', 'Other']

const GRADE_LEGEND = [
  ['A+', '≥80%', 'bg-emerald-100 text-emerald-700'],
  ['A',  '≥75%', 'bg-emerald-100 text-emerald-700'],
  ['A-', '≥70%', 'bg-green-100 text-green-700'],
  ['B+', '≥65%', 'bg-blue-100 text-blue-700'],
  ['B',  '≥60%', 'bg-blue-100 text-blue-700'],
  ['B-', '≥55%', 'bg-blue-100 text-blue-700'],
  ['C+', '≥50%', 'bg-amber-100 text-amber-700'],
  ['C',  '≥45%', 'bg-amber-100 text-amber-700'],
  ['C-', '≥40%', 'bg-amber-100 text-amber-700'],
  ['D+', '≥35%', 'bg-orange-100 text-orange-700'],
  ['D',  '≥33%', 'bg-orange-100 text-orange-700'],
  ['F',  '<33%', 'bg-red-100 text-red-700'],
]

const EXAM_TYPE_COLORS: Record<string, string> = {
  Midterm:      'bg-blue-100 text-blue-700',
  Final:        'bg-purple-100 text-purple-700',
  Quiz:         'bg-emerald-100 text-emerald-700',
  Assignment:   'bg-amber-100 text-amber-700',
  Lab:          'bg-cyan-100 text-cyan-700',
  Viva:         'bg-pink-100 text-pink-700',
  Presentation: 'bg-indigo-100 text-indigo-700',
  Other:        'bg-gray-100 text-gray-700',
}

const inputClass = 'w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none'
const labelClass = 'mb-1 block text-sm font-medium text-text-primary'

// ── Add Exam Modal (teacher only) ─────────────────────────────────────────────

function AddExamModal({ token, onClose, onSuccess }: { token: string; onClose: () => void; onSuccess: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [examName, setExamName] = useState('')
  const [examType, setExamType] = useState('Midterm')
  const [totalMarks, setTotalMarks] = useState('100')
  const [creditHours, setCreditHours] = useState('3.0')
  const [examDate, setExamDate] = useState('')
  const [semester, setSemester] = useState('')
  const [description, setDescription] = useState('')
  const [courses, setCourses] = useState<ManualCourse[]>([])
  const [courseId, setCourseId] = useState<string>('')

  useEffect(() => {
    getManualCourses(token).then(r => setCourses(r.courses || [])).catch(() => {})
  }, [token])

  async function handleSave() {
    if (!examName.trim()) { setError('Exam name is required'); return }
    if (!totalMarks || Number(totalMarks) <= 0) { setError('Total marks must be > 0'); return }
    setSaving(true)
    setError('')
    try {
      await createExam(token, {
        exam_name:        examName.trim(),
        exam_type:        examType,
        total_marks:      Number(totalMarks),
        credit_hours:     Number(creditHours) || 3.0,
        exam_date:        examDate || undefined,
        semester:         semester || undefined,
        description:      description || undefined,
        manual_course_id: courseId ? Number(courseId) : undefined,
      })
      onSuccess()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create exam')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl">
        <h2 className="font-display text-lg font-bold text-text-primary mb-4">Add Exam</h2>
        {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Exam Name *</label>
            <input className={inputClass} value={examName} onChange={e => setExamName(e.target.value)} placeholder="DBMS Midterm 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Exam Type</label>
              <select className={inputClass} value={examType} onChange={e => setExamType(e.target.value)}>
                {EXAM_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Total Marks *</label>
              <input type="number" min="0.01" step="0.5" className={inputClass} value={totalMarks} onChange={e => setTotalMarks(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Credit Hours</label>
              <input type="number" min="0.5" step="0.5" max="6" className={inputClass} value={creditHours} onChange={e => setCreditHours(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Exam Date</label>
              <input type="date" className={inputClass} value={examDate} onChange={e => setExamDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Course (optional)</label>
            <select className={inputClass} value={courseId} onChange={e => setCourseId(e.target.value)}>
              <option value="">Standalone / No course</option>
              {courses.map(c => <option key={c.manual_course_id} value={c.manual_course_id}>{c.course_name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Semester</label>
            <input className={inputClass} value={semester} onChange={e => setSemester(e.target.value)} placeholder="Spring 2026" />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea className={inputClass} rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted hover:border-primary hover:text-primary transition">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Exam'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Teacher: enter marks for all students in an exam ──────────────────────────

function EnterMarksModal({ token, exam, onClose, onSuccess }: { token: string; exam: Exam; onClose: () => void; onSuccess: () => void }) {
  const [marks, setMarks] = useState<Record<number, { marks: string; saved: boolean; saving: boolean; grade?: string }>>({})
  const [students, setStudents] = useState<CourseStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        // 1. Get all enrolled students from the course
        let studentList: CourseStudent[] = []
        if (exam.manual_course_id) {
          const res = await getCourseStudents(token, exam.manual_course_id)
          studentList = res.students || []
        }

        // 2. Get any marks already entered for this exam
        const marksRes = await getExamMarks(token, exam.exam_id)
        const existingMarks = (marksRes.marks || []) as ExamMark[]
        const marksMap = Object.fromEntries(existingMarks.map(m => [m.student_id, m]))

        setStudents(studentList)

        // 3. Pre-fill with existing values; blank otherwise
        const init: typeof marks = {}
        for (const s of studentList) {
          const existing = marksMap[s.student_id]
          init[s.student_id] = {
            marks: existing ? String(existing.marks_obtained) : '',
            saved: !!existing,
            saving: false,
            grade: existing?.grade ?? undefined,
          }
        }
        setMarks(init)
      } catch {
        setError('Failed to load students.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [exam.exam_id, exam.manual_course_id])

  async function saveMark(studentId: number) {
    const entry = marks[studentId]
    if (!entry) return
    const v = parseFloat(entry.marks)
    if (isNaN(v) || v < 0) return
    setMarks(prev => ({ ...prev, [studentId]: { ...prev[studentId], saving: true } }))
    try {
      const saved = await upsertMark(token, exam.exam_id, studentId, v)
      setMarks(prev => ({
        ...prev,
        [studentId]: { ...prev[studentId], saved: true, saving: false, grade: saved.grade ?? undefined },
      }))
    } catch {
      setMarks(prev => ({ ...prev, [studentId]: { ...prev[studentId], saving: false } }))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl">
        <h2 className="font-display text-base font-bold text-text-primary mb-1">Enter Marks</h2>
        <p className="text-xs text-muted mb-4">{exam.exam_name} · Total: {exam.total_marks}</p>

        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-12 animate-pulse rounded-xl bg-border"/>)}</div>
        ) : error ? (
          <p className="text-sm text-red-500 text-center py-4">{error}</p>
        ) : students.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">
            {exam.manual_course_id
              ? 'No students enrolled in this course yet.'
              : 'This exam is not linked to a course. Link it to a course to enter marks per student.'}
          </p>
        ) : (
          <div className="space-y-2">
            {students.map(s => {
              const sid = s.student_id
              const entry = marks[sid] || { marks: '', saved: false, saving: false }
              return (
                <div key={sid} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {s.first_name} {s.last_name}
                    </p>
                    <p className="text-xs text-muted">{s.student_roll}</p>
                  </div>
                  {entry.grade && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">{entry.grade}</span>
                  )}
                  <input
                    type="number"
                    min="0"
                    max={exam.total_marks}
                    step="0.5"
                    value={entry.marks}
                    onChange={e => setMarks(prev => ({ ...prev, [sid]: { ...prev[sid], marks: e.target.value, saved: false } }))}
                    className="w-20 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-center focus:border-accent focus:outline-none"
                    placeholder="—"
                  />
                  <span className="text-xs text-muted">/ {exam.total_marks}</span>
                  <button
                    onClick={() => saveMark(sid)}
                    disabled={entry.saving || entry.saved}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      entry.saved ? 'bg-emerald-100 text-emerald-700' : 'bg-primary text-white hover:opacity-90'
                    } disabled:opacity-60`}
                  >
                    <Save className="h-3 w-3" />
                    {entry.saving ? '…' : entry.saved ? 'Saved' : 'Save'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button onClick={() => { onSuccess(); onClose() }} className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition">Done</button>
        </div>
      </div>
    </div>
  )
}

// ── Grade chip ────────────────────────────────────────────────────────────────

function GradeChip({ grade }: { grade?: string | null }) {
  if (!grade) return null
  const style = grade.startsWith('A') ? 'bg-emerald-100 text-emerald-700'
    : grade.startsWith('B') ? 'bg-blue-100 text-blue-700'
    : grade.startsWith('C') ? 'bg-amber-100 text-amber-700'
    : grade === 'F' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>{grade}</span>
}

// ── Exam card ─────────────────────────────────────────────────────────────────

function ExamCard({ exam, token, role, onRefresh }: { exam: Exam; token: string; role: string; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [showMarksModal, setShowMarksModal] = useState(false)
  const mark = exam.my_mark

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${EXAM_TYPE_COLORS[exam.exam_type] || 'bg-gray-100 text-gray-700'}`}>
                {exam.exam_type}
              </span>
              {/* Students see their own grade chip */}
              {role === 'student' && <GradeChip grade={mark?.grade} />}
            </div>
            <h3 className="font-semibold text-sm text-text-primary mt-1.5">{exam.exam_name}</h3>
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted">
              <span>Total: {exam.total_marks} marks</span>
              <span>Credit: {exam.credit_hours}</span>
              {/* Student-only: show their result */}
              {role === 'student' && mark && (
                <>
                  <span className="font-medium text-text-primary">
                    Score: {mark.marks_obtained}/{exam.total_marks}
                  </span>
                  {mark.grade_points != null && <span>GP: {mark.grade_points}</span>}
                </>
              )}
              {exam.exam_date && <span>{new Date(exam.exam_date).toLocaleDateString()}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Teacher: enter marks button */}
            {role === 'teacher' && (
              <button
                onClick={() => setShowMarksModal(true)}
                className="flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
              >
                <Save className="h-3 w-3" /> Enter Marks
              </button>
            )}
            <button onClick={() => setExpanded(x => !x)} className="text-muted hover:text-primary">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border">
            {role === 'student' && !mark && (
              <p className="text-xs text-muted italic">Your teacher hasn't entered marks for this exam yet.</p>
            )}
            {exam.exam_date && (
              <p className="text-xs text-muted">Date: {new Date(exam.exam_date).toLocaleDateString()}</p>
            )}
            {exam.semester && (
              <p className="text-xs text-muted">Semester: {exam.semester}</p>
            )}
            {(exam as Record<string, unknown>).description && (
              <p className="text-xs text-muted mt-1">{(exam as Record<string, unknown>).description as string}</p>
            )}
          </div>
        )}
      </div>

      {showMarksModal && (
        <EnterMarksModal token={token} exam={exam} onClose={() => setShowMarksModal(false)} onSuccess={onRefresh} />
      )}
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function ExamMarksTab({ token, role, userId }: Props) {
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showLegend, setShowLegend] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getExams(token)
      setExams(res.exams || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-text-primary">Exam Marks</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLegend(x => !x)}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:border-primary hover:text-primary transition"
          >
            <Info className="h-3.5 w-3.5" /> Grade Scale
          </button>
          {/* Add Exam — teacher only */}
          {role === 'teacher' && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
            >
              <Plus className="h-3.5 w-3.5" /> Add Exam
            </button>
          )}
        </div>
      </div>

      {showLegend && (
        <div className="mb-4 rounded-xl border border-border bg-background p-3">
          <h3 className="text-xs font-semibold text-muted mb-2 uppercase tracking-wide">Grade Scale</h3>
          <div className="flex flex-wrap gap-1.5">
            {GRADE_LEGEND.map(([g, pct, cls]) => (
              <span key={g} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{g} {pct}</span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse bg-border rounded-xl" />)}
        </div>
      ) : exams.length === 0 ? (
        <div className="text-center py-10">
          <FileText className="h-10 w-10 text-border mx-auto mb-3" />
          <p className="text-sm text-muted">
            {role === 'teacher' ? 'No exams yet. Add your first exam.' : 'No exams published yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {exams.map(exam => (
            <ExamCard key={exam.exam_id} exam={exam} token={token} role={role} onRefresh={load} />
          ))}
        </div>
      )}

      {showAdd && <AddExamModal token={token} onClose={() => setShowAdd(false)} onSuccess={load} />}
    </div>
  )
}
