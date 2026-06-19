'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, BookOpen, Copy, Check, Users, ArrowLeft, Link } from 'lucide-react'
import {
  getManualCourses, createManualCourse, joinManualCourse,
  type ManualCourse,
} from '@/app/lib/classesApi'
import StudentsPanel from './StudentsPanel'
import ResourcesPanel from './ResourcesPanel'

type Props = {
  token: string
  role: 'teacher' | 'student'
  userId: string
}

const inputClass = 'w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none'
const labelClass = 'mb-1 block text-sm font-medium text-text-primary'

// ── Unchanged modals ──────────────────────────────────────────────────────────

function CreateCourseModal({ token, onClose, onSuccess }: { token: string; onClose: () => void; onSuccess: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [courseName, setCourseName] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [description, setDescription] = useState('')
  const [creditHours, setCreditHours] = useState('3.0')
  const [enrollCode, setEnrollCode] = useState(() => Math.random().toString(36).slice(2, 8).toUpperCase())
  const [semester, setSemester] = useState('')
  const [academicYear, setAcademicYear] = useState('')

  async function handleCreate() {
    if (!courseName.trim()) { setError('Course name is required'); return }
    setSaving(true)
    setError('')
    try {
      await createManualCourse(token, {
        course_name: courseName.trim(),
        course_code: courseCode || undefined,
        description: description || undefined,
        credit_hours: parseFloat(creditHours) || 3.0,
        enroll_code: enrollCode || undefined,
        semester: semester || undefined,
        academic_year: academicYear || undefined,
      })
      onSuccess()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create course')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl">
        <h2 className="font-display text-lg font-bold text-text-primary mb-4">Create Course</h2>
        {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Course Name *</label>
            <input className={inputClass} value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="Database Management Systems" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Course Code</label><input className={inputClass} value={courseCode} onChange={e => setCourseCode(e.target.value)} placeholder="CSE-301" /></div>
            <div><label className={labelClass}>Credit Hours</label><input type="number" step="0.5" min="0.5" max="6" className={inputClass} value={creditHours} onChange={e => setCreditHours(e.target.value)} /></div>
          </div>
          <div><label className={labelClass}>Description</label><textarea className={inputClass} rows={2} value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div>
            <label className={labelClass}>Enrollment Code</label>
            <div className="flex gap-2">
              <input className={inputClass} value={enrollCode} onChange={e => setEnrollCode(e.target.value.toUpperCase().slice(0, 20))} />
              <button onClick={() => setEnrollCode(Math.random().toString(36).slice(2, 8).toUpperCase())} className="rounded-xl border border-border px-3 text-xs text-muted hover:border-primary hover:text-primary transition">Regen</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Semester</label><input className={inputClass} value={semester} onChange={e => setSemester(e.target.value)} placeholder="Spring 2026" /></div>
            <div><label className={labelClass}>Academic Year</label><input className={inputClass} value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2025-2026" /></div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted hover:border-primary hover:text-primary transition">Cancel</button>
          <button onClick={handleCreate} disabled={saving} className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-60">
            {saving ? 'Creating…' : 'Create Course'}
          </button>
        </div>
      </div>
    </div>
  )
}

function JoinCourseModal({ token, onClose, onSuccess }: { token: string; onClose: () => void; onSuccess: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [joined, setJoined] = useState<{ course_name: string; instructor?: string } | null>(null)

  async function handleJoin() {
    if (code.length < 4) { setError('Enter a valid enrollment code'); return }
    setSaving(true)
    setError('')
    try {
      const res = await joinManualCourse(token, code.toUpperCase())
      const c = res.course
      const instr = (c as Record<string, unknown>).instructor as Record<string, string> | undefined
      setJoined({ course_name: c.course_name, instructor: instr ? `${instr.first_name} ${instr.last_name}` : undefined })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join course')
    }
    setSaving(false)
  }

  if (joined) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
        <div className="relative w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mx-auto mb-3"><Check className="h-7 w-7" /></div>
          <h2 className="font-display text-lg font-bold text-text-primary">Joined!</h2>
          <p className="text-sm text-muted mt-1">{joined.course_name}</p>
          {joined.instructor && <p className="text-xs text-muted mt-0.5">Instructor: {joined.instructor}</p>}
          <button onClick={() => { onSuccess(); onClose() }} className="mt-4 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
      <div className="relative w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
        <h2 className="font-display text-lg font-bold text-text-primary mb-4">Join Course</h2>
        {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
        <div><label className={labelClass}>Enrollment Code</label>
          <input className={inputClass} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={20} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted hover:border-primary hover:text-primary transition">Cancel</button>
          <button onClick={handleJoin} disabled={saving} className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-60">
            {saving ? 'Joining…' : 'Join Course'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Course detail expanded view ───────────────────────────────────────────────

type DetailTab = 'students' | 'resources'

function CourseDetail({ token, course, role, onBack }: { token: string; course: ManualCourse; role: 'teacher' | 'student'; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<DetailTab>(role === 'teacher' ? 'students' : 'resources')
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const joinLink = `${origin}/dashboard/classes?join=${(course as Record<string, unknown>).join_link_token || ''}`

  function copy(text: string, type: 'code' | 'link') {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const INNER_TABS: { id: DetailTab; label: string }[] = role === 'teacher'
    ? [{ id: 'students', label: 'Students' }, { id: 'resources', label: 'Resources' }]
    : [{ id: 'resources', label: 'Resources' }]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >
      {/* Back + header */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted hover:text-primary transition">
        <ArrowLeft className="h-4 w-4" /> Back to all courses
      </button>

      <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-lg font-bold text-text-primary">{course.course_name}</h2>
              {course.course_code && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{course.course_code}</span>}
              {course.semester && <span className="rounded-full bg-border px-2.5 py-0.5 text-xs text-muted">{course.semester}</span>}
              {course.credit_hours && <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs text-accent">{course.credit_hours} cr</span>}
            </div>
            {course.description && <p className="text-sm text-muted mt-1.5">{course.description}</p>}
          </div>
        </div>

        {role === 'teacher' && (
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <span className="text-muted">Join Code:</span>
              <span className="font-mono font-bold text-text-primary">{course.enroll_code}</span>
              <button onClick={() => copy(course.enroll_code, 'code')} className="text-muted hover:text-primary transition">
                {copied === 'code' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            {(course as Record<string, unknown>).join_link_token && (
              <button
                onClick={() => copy(joinLink, 'link')}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-muted hover:border-accent hover:text-accent transition"
              >
                {copied === 'link' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Link className="h-3.5 w-3.5" />}
                {copied === 'link' ? 'Copied!' : 'Copy Join Link'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Inner tab bar */}
      {INNER_TABS.length > 1 && (
        <div className="flex gap-1 rounded-xl border border-border bg-background p-1 w-fit">
          {INNER_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === t.id ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Inner tab content */}
      <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            {activeTab === 'students' && (
              <StudentsPanel
                token={token}
                courseId={course.manual_course_id}
                joinLinkToken={(course as Record<string, unknown>).join_link_token as string || ''}
                role={role}
              />
            )}
            {activeTab === 'resources' && (
              <ResourcesPanel token={token} courseId={course.manual_course_id} role={role} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ── Course card ───────────────────────────────────────────────────────────────

function CourseCard({ course, role, onClick, copiedCode, onCopyCode }: {
  course: ManualCourse
  role: 'teacher' | 'student'
  onClick: () => void
  copiedCode: string | null
  onCopyCode: (code: string) => void
}) {
  const enrollCount = (course as Record<string, unknown>).enrollment_count as number || 0
  const instr = course.instructor as Record<string, string> | undefined

  return (
    <div
      onClick={onClick}
      className="rounded-xl border border-border bg-card p-4 hover:border-accent/60 hover:shadow-md transition cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-text-primary truncate">{course.course_name}</h3>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {course.course_code && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{course.course_code}</span>}
                {course.semester && <span className="rounded-full bg-border px-2 py-0.5 text-[11px] text-muted">{course.semester}</span>}
                {course.credit_hours && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">{course.credit_hours} cr</span>}
              </div>
            </div>
          </div>

          {role === 'teacher' ? (
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-xs text-muted">
                <Users className="h-3.5 w-3.5" />{enrollCount} students
              </span>
              <button
                onClick={e => { e.stopPropagation(); onCopyCode(course.enroll_code) }}
                className="flex items-center gap-1 rounded-lg border border-border px-2 py-0.5 text-xs text-muted hover:border-primary hover:text-primary transition"
              >
                {copiedCode === course.enroll_code ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                {course.enroll_code}
              </button>
            </div>
          ) : instr ? (
            <p className="text-xs text-muted mt-1.5">Instructor: {instr.first_name} {instr.last_name}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ManualCoursesTab({ token, role, userId }: Props) {
  const [courses, setCourses] = useState<ManualCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<ManualCourse | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getManualCourses(token)
      setCourses(res.courses || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  // If a course is selected, show its detail view
  if (selectedCourse) {
    return (
      <CourseDetail
        token={token}
        course={selectedCourse}
        role={role}
        onBack={() => setSelectedCourse(null)}
      />
    )
  }

  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-text-primary">My Courses</h2>
        {role === 'teacher' ? (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition">
            <Plus className="h-3.5 w-3.5" /> Create Course
          </button>
        ) : (
          <button onClick={() => setShowJoin(true)} className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition">
            <Plus className="h-3.5 w-3.5" /> Join Course
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-border" />)}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-10">
          <BookOpen className="h-10 w-10 text-border mx-auto mb-3" />
          <p className="text-sm text-muted">
            {role === 'teacher' ? 'No courses yet. Create your first course!' : 'Not enrolled in any courses. Join with an enrollment code!'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {courses.map(course => (
            <CourseCard
              key={course.manual_course_id}
              course={course}
              role={role}
              onClick={() => setSelectedCourse(course)}
              copiedCode={copiedCode}
              onCopyCode={copyCode}
            />
          ))}
        </div>
      )}

      {showCreate && <CreateCourseModal token={token} onClose={() => setShowCreate(false)} onSuccess={load} />}
      {showJoin && <JoinCourseModal token={token} onClose={() => setShowJoin(false)} onSuccess={load} />}
    </div>
  )
}
