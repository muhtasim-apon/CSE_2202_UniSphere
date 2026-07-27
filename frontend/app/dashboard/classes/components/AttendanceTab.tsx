'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckSquare, AlertTriangle, Plus, CalendarDays, ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  getCourseAttendanceFull, getMyAttendanceDetail, createAttendanceSession, updateAttendanceRecord,
  attendanceBand, ATTENDANCE_BAND_LABEL,
  type AttendanceBand, type SessionWithRecords, type StudentAttendanceCourse,
} from '@/app/lib/classesApi'

type Props = {
  token: string
  role: 'teacher' | 'student'
  courseId?: number
  courseName?: string
}

const STATUS_STYLES: Record<string, string> = {
  Present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Absent:  'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  Late:    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  Excused: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
}
const STATUSES = ['Present', 'Absent', 'Late', 'Excused'] as const

// Final-exam eligibility bands (curriculum §18.6)
const BAND_STYLES: Record<AttendanceBand, { border: string; bg: string; text: string; bar: string }> = {
  eligible: {
    border: 'border-border', bg: 'bg-card',
    text: 'text-emerald-600 dark:text-emerald-300', bar: 'bg-emerald-500',
  },
  fined: {
    border: 'border-amber-200 dark:border-amber-500/30', bg: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-300', bar: 'bg-amber-500',
  },
  barred: {
    border: 'border-red-200 dark:border-red-500/30', bg: 'bg-red-50 dark:bg-red-500/10',
    text: 'text-red-600 dark:text-red-300', bar: 'bg-red-500',
  },
}

/** Local calendar date (YYYY-MM-DD). toISOString() is UTC and rolls an evening
 *  class in UTC+6 back to the previous day. */
function todayLocalISO(): string {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

// ── Teacher view ─────────────────────────────────────────────────────────────

function TeacherView({ token, courseId }: { token: string; courseId: number }) {
  const [sessions, setSessions] = useState<SessionWithRecords[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [statusMap, setStatusMap] = useState<Record<string, string>>({})

  const [sessionDate, setSessionDate] = useState(todayLocalISO)
  const [sessionTitle, setSessionTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [saveError, setSaveError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    getCourseAttendanceFull(token, courseId)
      .then(res => setSessions(res.sessions || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token, courseId])

  useEffect(() => { load() }, [load])

  async function startSession() {
    setSaving(true)
    setFormError('')
    try {
      await createAttendanceSession(token, {
        manual_course_id: courseId,
        session_date: sessionDate,
        session_title: sessionTitle || undefined,
        topic: topic || undefined,
      })
      setSessionTitle('')
      setTopic('')
      load()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to start session')
    }
    setSaving(false)
  }

  async function updateStatus(sessionId: number, studentId: number, status: string) {
    const key = `${sessionId}-${studentId}`
    const previous = statusMap[key]
    setStatusMap(prev => ({ ...prev, [key]: status }))
    try {
      await updateAttendanceRecord(token, sessionId, studentId, status)
      setSaveError('')
    } catch (e: unknown) {
      // Roll the optimistic write back — a silent failure would leave the
      // teacher believing attendance was saved.
      setStatusMap(prev => {
        const next = { ...prev }
        if (previous === undefined) delete next[key]
        else next[key] = previous
        return next
      })
      setSaveError(e instanceof Error ? e.message : 'Failed to save attendance')
    }
  }

  const inputClass = 'w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none'

  return (
    <div className="space-y-5">
      {/* New session form */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <h3 className="font-semibold text-sm text-text-primary">Start New Session</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Date</label>
            <input type="date" className={inputClass} value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Title</label>
            <input className={inputClass} value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} placeholder="Lecture 5" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Topic</label>
            <input className={inputClass} value={topic} onChange={e => setTopic(e.target.value)} placeholder="Normalization" />
          </div>
        </div>
        {formError && <p className="text-xs text-red-600 dark:text-red-300">{formError}</p>}
        <button
          onClick={startSession}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl bg-cta px-4 py-2 text-sm font-semibold text-cta-text hover:opacity-90 transition disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {saving ? 'Starting…' : 'Start Session & Mark Attendance'}
        </button>
      </div>

      {/* Session log */}
      <div>
        <h3 className="font-semibold text-sm text-text-primary mb-2">Session Log</h3>
        {saveError && (
          <p className="mb-2 rounded-xl bg-red-50 px-4 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {saveError}
          </p>
        )}
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-14 animate-pulse rounded-xl bg-border"/>)}</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-10 rounded-xl border border-dashed border-border">
            <CalendarDays className="h-8 w-8 text-border mx-auto mb-2" />
            <p className="text-sm text-muted">No sessions yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => {
              const open = expandedId === s.session_id
              const sm = s.summary
              return (
                <div key={s.session_id} className="rounded-xl border border-border overflow-hidden">
                  <button
                    onClick={() => setExpandedId(open ? null : s.session_id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/5 transition text-left"
                  >
                    <CalendarDays className="h-4 w-4 text-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        {s.session_title || s.topic || 'Session'}&nbsp;
                        <span className="font-normal text-muted">
                          — {new Date(s.session_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </p>
                      {s.topic && s.session_title && <p className="text-xs text-muted">{s.topic}</p>}
                    </div>
                    <div className="flex items-center gap-2 text-xs flex-shrink-0">
                      <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 font-semibold dark:bg-emerald-500/15 dark:text-emerald-300">{sm.present}P</span>
                      <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 font-semibold dark:bg-red-500/15 dark:text-red-300">{sm.absent}A</span>
                      {sm.late > 0 && <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-semibold dark:bg-amber-500/15 dark:text-amber-300">{sm.late}L</span>}
                      {sm.excused > 0 && <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 font-semibold dark:bg-blue-500/15 dark:text-blue-300">{sm.excused}E</span>}
                      <span className="text-muted">{sm.total} total</span>
                    </div>
                    {open ? <ChevronUp className="h-4 w-4 text-muted flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted flex-shrink-0" />}
                  </button>

                  {open && (
                    <div className="border-t border-border bg-background px-4 py-3">
                      {s.records.length === 0 ? (
                        <p className="text-sm text-muted text-center py-4">No records for this session.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {s.records.map(r => {
                            const st = r.student as { first_name: string; last_name: string; student_roll: string } | undefined
                            const key = `${s.session_id}-${r.student_id}`
                            const currentStatus = statusMap[key] || r.status
                            return (
                              <div key={r.student_id} className="flex items-center gap-3 rounded-lg bg-card px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-text-primary truncate">
                                    {st ? `${st.first_name} ${st.last_name}` : `Student ${r.student_id}`}
                                  </p>
                                  {st?.student_roll && <p className="text-xs text-muted">{st.student_roll}</p>}
                                </div>
                                <div className="flex gap-1">
                                  {STATUSES.map(status => (
                                    <button
                                      key={status}
                                      onClick={() => updateStatus(s.session_id, r.student_id, status)}
                                      title={status}
                                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                                        currentStatus === status ? STATUS_STYLES[status] : 'bg-border text-muted hover:bg-accent/10'
                                      }`}
                                    >
                                      {status.charAt(0)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Student view (all courses) ────────────────────────────────────────────────

function StudentView({ token }: { token: string }) {
  const [courses, setCourses] = useState<StudentAttendanceCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCourse, setExpandedCourse] = useState<number | null>(null)

  useEffect(() => {
    getMyAttendanceDetail(token)
      .then(res => {
        const data = res.courses || []
        setCourses(data)
        if (data.length > 0) setExpandedCourse(data[0].course_id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 animate-pulse rounded-xl bg-border"/>)}</div>
  )

  if (courses.length === 0) return (
    <div className="text-center py-16">
      <CheckSquare className="h-10 w-10 text-border mx-auto mb-3" />
      <p className="text-sm text-muted">No enrolled courses with attendance records yet.</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {courses.map(c => {
        const open = expandedCourse === c.course_id
        const pct = c.attendance_pct
        const scored = c.total_sessions > 0
        const band = attendanceBand(pct)
        const style = scored ? BAND_STYLES[band] : BAND_STYLES.eligible

        return (
          <div key={c.course_id} className={`rounded-xl border overflow-hidden ${style.border}`}>
            <button
              onClick={() => setExpandedCourse(open ? null : c.course_id)}
              className={`w-full text-left px-4 py-3 hover:bg-accent/5 transition ${scored ? style.bg : 'bg-card'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-text-primary">{c.course_name}</p>
                    {c.course_code && <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">{c.course_code}</span>}
                    {scored && band !== 'eligible' && <AlertTriangle className={`h-3.5 w-3.5 ${style.text}`} />}
                  </div>
                  {c.semester && <p className="text-xs text-muted mt-0.5">{c.semester}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-sm font-bold ${scored ? style.text : 'text-muted'}`}>{pct}%</span>
                  {open ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                </div>
              </div>

              <div className="mt-2 h-1.5 rounded-full bg-border">
                <div className={`h-1.5 rounded-full transition-all ${style.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>

              <div className="mt-2 flex gap-3 text-xs">
                <span className="text-emerald-700 dark:text-emerald-300">✓ {c.present} Present</span>
                <span className="text-red-700 dark:text-red-300">✗ {c.absent} Absent</span>
                {c.late > 0 && <span className="text-amber-700 dark:text-amber-300">◐ {c.late} Late</span>}
                {c.excused > 0 && <span className="text-blue-700 dark:text-blue-300">~ {c.excused} Excused</span>}
                <span className="text-muted">{c.total_sessions} total</span>
              </div>
              {scored && (
                <p className={`mt-1 text-xs font-medium ${style.text}`}>
                  {band === 'eligible' ? '✓' : '⚠'} {ATTENDANCE_BAND_LABEL[band]}
                </p>
              )}
            </button>

            {open && (
              <div className="border-t border-border bg-background">
                {c.sessions.length === 0 ? (
                  <p className="text-sm text-muted text-center py-6">No sessions recorded yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted">Date</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted">Session</th>
                        <th className="text-center px-4 py-2 text-xs font-semibold text-muted">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...c.sessions].reverse().map(s => (
                        <tr key={s.session_id} className="border-b border-border/50 last:border-0 hover:bg-accent/5">
                          <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">
                            {new Date(s.session_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-text-primary">
                            {s.session_title || s.topic || <span className="italic text-muted">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {s.status ? (
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[s.status]}`}>
                                {s.status}
                              </span>
                            ) : (
                              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500 dark:bg-gray-500/15 dark:text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

export default function AttendanceTab({ token, role, courseId, courseName }: Props) {
  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-semibold text-text-primary mb-0.5">Attendance</h2>
      {courseName
        ? <p className="text-xs text-muted mb-4">{courseName}</p>
        : <p className="text-xs text-muted mb-4">All enrolled courses</p>
      }
      {role === 'teacher' && courseId != null ? (
        <TeacherView token={token} courseId={courseId} />
      ) : (
        <StudentView token={token} />
      )}
    </div>
  )
}
