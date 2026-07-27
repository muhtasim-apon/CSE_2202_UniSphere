'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, FileText, Info, Save, ChevronDown, ChevronUp } from 'lucide-react'
import {
  getCourseGradebook, getMyAllMarks, createExam, upsertMark,
  type GradebookExam, type GradebookStudent, type StudentMarksCourse, type StudentMarkEntry,
} from '@/app/lib/classesApi'

type Props = {
  token: string
  role: 'teacher' | 'student'
  userId: string
  courseId?: number
  courseName?: string
  courseCode?: string | null
  creditHours?: number
  onMarkSaved?: () => void
}

const EXAM_TYPES = ['Midterm', 'Final', 'Quiz', 'Assignment', 'Lab', 'Viva', 'Presentation', 'Other']

const EXAM_TYPE_COLORS: Record<string, string> = {
  Midterm:      'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  Final:        'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  Quiz:         'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Assignment:   'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  Lab:          'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  Viva:         'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  Presentation: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  Other:        'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300',
}

const GRADE_LEGEND = [
  ['A+','≥80%','bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'],
  ['A','≥75%','bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'],
  ['A-','≥70%','bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'],
  ['B+','≥65%','bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'],
  ['B','≥60%','bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'],
  ['B-','≥55%','bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'],
  ['C+','≥50%','bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'],
  ['C','≥45%','bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'],
  ['D','≥40%','bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300'],
  ['F','<40%','bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'],
]

function GradeChip({ grade }: { grade?: string | null }) {
  if (!grade) return null
  const cls = grade.startsWith('A') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
    : grade.startsWith('B') ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
    : grade.startsWith('C') ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
    : grade === 'D' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300'
    : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{grade}</span>
}

const inputClass = 'w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none'
const labelClass = 'mb-1 block text-sm font-medium text-text-primary'

// ── Add Exam Modal ────────────────────────────────────────────────────────────
function AddExamModal({ token, courseId, creditHoursDefault, onClose, onSuccess }: {
  token: string; courseId: number; creditHoursDefault: number; onClose: () => void; onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [examName, setExamName] = useState('')
  const [examType, setExamType] = useState('Midterm')
  const [totalMarks, setTotalMarks] = useState('100')
  const [creditHours, setCreditHours] = useState(String(creditHoursDefault))
  const [examDate, setExamDate] = useState('')
  const [semester, setSemester] = useState('')
  const [description, setDescription] = useState('')

  async function handleSave() {
    if (!examName.trim()) { setError('Exam name is required'); return }
    if (!totalMarks || Number(totalMarks) <= 0) { setError('Total marks must be > 0'); return }
    setSaving(true); setError('')
    try {
      await createExam(token, {
        exam_name: examName.trim(), exam_type: examType,
        total_marks: Number(totalMarks), credit_hours: Number(creditHours) || creditHoursDefault,
        exam_date: examDate || undefined, semester: semester || undefined,
        description: description || undefined, manual_course_id: courseId,
      })
      onSuccess(); onClose()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl">
        <h2 className="font-display text-lg font-bold text-text-primary mb-4">Add Exam</h2>
        {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <div className="space-y-3">
          <div><label className={labelClass}>Exam Name *</label><input className={inputClass} value={examName} onChange={e => setExamName(e.target.value)} placeholder="Midterm 2026" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Type</label>
              <select className={inputClass} value={examType} onChange={e => setExamType(e.target.value)}>
                {EXAM_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Total Marks *</label><input type="number" min="0.01" step="0.5" className={inputClass} value={totalMarks} onChange={e => setTotalMarks(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Credit Hours</label><input type="number" min="0.5" step="0.5" max="6" className={inputClass} value={creditHours} onChange={e => setCreditHours(e.target.value)} /></div>
            <div><label className={labelClass}>Exam Date</label><input type="date" className={inputClass} value={examDate} onChange={e => setExamDate(e.target.value)} /></div>
          </div>
          <div><label className={labelClass}>Semester</label><input className={inputClass} value={semester} onChange={e => setSemester(e.target.value)} placeholder="Spring 2026" /></div>
          <div><label className={labelClass}>Description</label><textarea className={inputClass} rows={2} value={description} onChange={e => setDescription(e.target.value)} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted hover:border-primary hover:text-primary transition">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="rounded-xl bg-cta px-5 py-2 text-sm font-semibold text-cta-text hover:opacity-90 transition disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Teacher grade book view ───────────────────────────────────────────────────
function TeacherView({ token, courseId, creditHours = 3, onMarkSaved }: {
  token: string; courseId: number; courseName: string; courseCode: string | null; creditHours: number; onMarkSaved?: () => void
}) {
  const [exams, setExams] = useState<GradebookExam[]>([])
  const [students, setStudents] = useState<GradebookStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const [expandedExam, setExpandedExam] = useState<number | null>(null)
  const [markInputs, setMarkInputs] = useState<Record<string, { val: string; saving: boolean; saved: boolean }>>({})
  const [saveError, setSaveError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    getCourseGradebook(token, courseId)
      .then(res => {
        setExams(res.exams || [])
        setStudents(res.students || [])
        const init: typeof markInputs = {}
        for (const stu of (res.students || [])) {
          for (const [eid, m] of Object.entries(stu.marks)) {
            init[`${eid}-${stu.student_id}`] = { val: String(m.marks_obtained), saving: false, saved: true }
          }
        }
        setMarkInputs(init)
        if ((res.exams || []).length > 0) setExpandedExam((res.exams || [])[0].exam_id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token, courseId])

  useEffect(() => { load() }, [load])

  async function saveMark(examId: number, studentId: number) {
    const k = `${examId}-${studentId}`
    const exam = exams.find(e => e.exam_id === examId)
    const v = parseFloat(markInputs[k]?.val || '')
    if (isNaN(v) || v < 0) return
    // The input's `max` attribute is advisory; the server rejects this too.
    if (exam && v > exam.total_marks) {
      setSaveError(`Mark cannot exceed the exam total of ${exam.total_marks}`)
      return
    }
    setSaveError('')
    setMarkInputs(prev => ({ ...prev, [k]: { ...prev[k], saving: true, saved: false } }))
    try {
      const updated = await upsertMark(token, examId, studentId, v)
      setMarkInputs(prev => ({ ...prev, [k]: { val: String(v), saving: false, saved: true } }))
      // Patch just this cell instead of refetching the whole gradebook, which
      // also collapsed whichever exam the teacher was working in.
      setStudents(prev => prev.map(s =>
        s.student_id === studentId
          ? { ...s, marks: { ...s.marks, [examId]: { ...s.marks[examId], ...updated } } }
          : s
      ))
      onMarkSaved?.()
    } catch (e: unknown) {
      setMarkInputs(prev => ({ ...prev, [k]: { ...prev[k], saving: false } }))
      setSaveError(e instanceof Error ? e.message : 'Failed to save mark')
    }
  }

  const grouped: Record<string, GradebookExam[]> = {}
  for (const e of exams) {
    ;(grouped[e.exam_type] = grouped[e.exam_type] || []).push(e)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setShowLegend(x => !x)} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:border-primary hover:text-primary transition">
          <Info className="h-3.5 w-3.5" /> Grade Scale
        </button>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-xl bg-cta px-3 py-1.5 text-xs font-semibold text-cta-text hover:opacity-90 transition">
          <Plus className="h-3.5 w-3.5" /> Add Exam
        </button>
      </div>

      {saveError && (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">
          {saveError}
        </p>
      )}

      {showLegend && (
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs font-semibold text-muted mb-2 uppercase tracking-wide">DU Grade Scale</p>
          <div className="flex flex-wrap gap-1.5">
            {GRADE_LEGEND.map(([g,pct,cls]) => <span key={g} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{g} {pct}</span>)}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 animate-pulse bg-border rounded-xl"/>)}</div>
      ) : exams.length === 0 ? (
        <div className="text-center py-10">
          <FileText className="h-10 w-10 text-border mx-auto mb-3" />
          <p className="text-sm text-muted">No exams yet. Add your first exam above.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([type, typeExams]) => (
          <div key={type} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${EXAM_TYPE_COLORS[type] || 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300'}`}>{type}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {typeExams.map(exam => {
              const open = expandedExam === exam.exam_id
              const marked = students.filter(s => s.marks[exam.exam_id]).length
              return (
                <div key={exam.exam_id} className="rounded-xl border border-border overflow-hidden">
                  <button
                    onClick={() => setExpandedExam(open ? null : exam.exam_id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/5 transition text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary">{exam.exam_name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        Total: {exam.total_marks} marks · Credit: {exam.credit_hours}
                        {exam.exam_date && ` · ${new Date(exam.exam_date).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'})}`}
                        {' · '}<span className="text-primary font-medium">{marked}/{students.length} marked</span>
                      </p>
                    </div>
                    {open ? <ChevronUp className="h-4 w-4 text-muted flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted flex-shrink-0" />}
                  </button>

                  {open && (
                    <div className="border-t border-border bg-background">
                      {students.length === 0 ? (
                        <p className="text-sm text-muted text-center py-6">No enrolled students.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left px-4 py-2 text-xs font-semibold text-muted">Student</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-muted">Roll</th>
                              <th className="text-center px-4 py-2 text-xs font-semibold text-muted">Grade</th>
                              <th className="text-center px-4 py-2 text-xs font-semibold text-muted">Marks / {exam.total_marks}</th>
                              <th className="px-4 py-2" />
                            </tr>
                          </thead>
                          <tbody>
                            {students.map(stu => {
                              const k = `${exam.exam_id}-${stu.student_id}`
                              const existing = stu.marks[exam.exam_id]
                              const inp = markInputs[k] || { val: '', saving: false, saved: false }
                              return (
                                <tr key={stu.student_id} className="border-b border-border/50 last:border-0 hover:bg-accent/5">
                                  <td className="px-4 py-2.5 font-medium text-text-primary whitespace-nowrap">{stu.first_name} {stu.last_name}</td>
                                  <td className="px-4 py-2.5 text-xs text-muted">{stu.student_roll}</td>
                                  <td className="px-4 py-2.5 text-center">
                                    <GradeChip grade={existing?.grade} />
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <input
                                      type="number" min="0" max={exam.total_marks} step="0.5"
                                      value={inp.val}
                                      onChange={e => setMarkInputs(prev => ({ ...prev, [k]: { val: e.target.value, saving: false, saved: false } }))}
                                      className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-sm text-center focus:border-accent focus:outline-none"
                                      placeholder="—"
                                    />
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <button
                                      onClick={() => saveMark(exam.exam_id, stu.student_id)}
                                      disabled={inp.saving || inp.saved || !inp.val}
                                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                                        inp.saved ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-cta text-cta-text hover:opacity-90'
                                      } disabled:opacity-50`}
                                    >
                                      <Save className="h-3 w-3" />
                                      {inp.saving ? '…' : inp.saved ? 'Saved' : 'Save'}
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))
      )}

      {showAdd && (
        <AddExamModal token={token} courseId={courseId} creditHoursDefault={creditHours} onClose={() => setShowAdd(false)} onSuccess={load} />
      )}
    </div>
  )
}

// ── Student all-courses marks view ────────────────────────────────────────────
function StudentView({ token }: { token: string }) {
  const [courses, setCourses] = useState<StudentMarksCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCourse, setExpandedCourse] = useState<number | null>(null)

  useEffect(() => {
    getMyAllMarks(token)
      .then(res => {
        const data = res.courses || []
        setCourses(data)
        if (data.length > 0) setExpandedCourse(data[0].course_id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 animate-pulse rounded-xl bg-border"/>)}</div>
  )

  if (courses.length === 0) return (
    <div className="text-center py-16">
      <FileText className="h-10 w-10 text-border mx-auto mb-3" />
      <p className="text-sm text-muted">No marks available yet.</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {courses.map(c => {
        const open = expandedCourse === c.course_id
        const totalExams = Object.values(c.by_type).reduce((a, v) => a + v.length, 0)
        const types = Object.keys(c.by_type)

        return (
          <div key={c.course_id} className="rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setExpandedCourse(open ? null : c.course_id)}
              className="w-full text-left px-4 py-3 hover:bg-accent/5 transition bg-card"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-text-primary">{c.course_name}</p>
                    {c.course_code && <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">{c.course_code}</span>}
                  </div>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {c.semester && <span className="text-xs text-muted">{c.semester}</span>}
                    {totalExams > 0 && <span className="text-xs text-muted">{totalExams} exam{totalExams !== 1 ? 's' : ''}</span>}
                    {types.map(t => <span key={t} className={`text-xs rounded-full px-2 py-0.5 font-medium ${EXAM_TYPE_COLORS[t] || 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300'}`}>{t}</span>)}
                  </div>
                </div>
                {open ? <ChevronUp className="h-4 w-4 text-muted flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted flex-shrink-0" />}
              </div>
            </button>

            {open && (
              <div className="border-t border-border bg-background divide-y divide-border">
                {totalExams === 0 ? (
                  <p className="text-sm text-muted text-center py-6">No marks recorded yet.</p>
                ) : (
                  Object.entries(c.by_type).map(([type, marks]) => (
                    <div key={type} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${EXAM_TYPE_COLORS[type] || 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300'}`}>{type}</span>
                      </div>
                      <div className="space-y-1.5">
                        {(marks as StudentMarkEntry[]).map((m, idx) => (
                          <div key={m.exam_id ?? idx} className="flex items-center gap-3 rounded-lg bg-card px-3 py-2.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text-primary">{m.exam_name}</p>
                              {m.exam_date && <p className="text-xs text-muted">{new Date(m.exam_date).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'})}</p>}
                            </div>
                            <div className="flex items-center gap-2 text-sm flex-shrink-0">
                              <span className="font-semibold text-text-primary">{m.marks_obtained}/{m.total_marks}</span>
                              <GradeChip grade={m.grade} />
                              {m.grade_points != null && (
                                <span className="text-xs text-muted">GP {m.grade_points.toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ExamMarksTab({ token, role, userId: _userId, courseId, courseName, courseCode, creditHours = 3, onMarkSaved }: Props) {
  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text-primary">Exam Marks</h2>
        {courseName
          ? <p className="text-xs text-muted mt-0.5">{courseName}{courseCode ? ` · ${courseCode}` : ''}</p>
          : <p className="text-xs text-muted mt-0.5">All enrolled courses</p>
        }
      </div>
      {role === 'teacher' && courseId != null ? (
        <TeacherView
          token={token}
          courseId={courseId}
          courseName={courseName || ''}
          courseCode={courseCode ?? null}
          creditHours={creditHours}
          onMarkSaved={onMarkSaved}
        />
      ) : (
        <StudentView token={token} />
      )}
    </div>
  )
}
