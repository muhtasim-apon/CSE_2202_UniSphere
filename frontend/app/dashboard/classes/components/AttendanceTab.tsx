'use client'

import { useState, useEffect } from 'react'
import { CheckSquare, AlertTriangle, Plus, Save } from 'lucide-react'
import {
  getManualCourses, createAttendanceSession, updateAttendanceRecord,
  getMyAttendanceSummary, getCourseAttendance,
  type ManualCourse, type AttendanceRecord,
} from '@/app/lib/classesApi'

type Props = {
  token: string
  role: 'teacher' | 'student'
}

const STATUS_STYLES: Record<string, string> = {
  Present: 'bg-emerald-100 text-emerald-700',
  Absent: 'bg-red-100 text-red-700',
  Late: 'bg-amber-100 text-amber-700',
  Excused: 'bg-blue-100 text-blue-700',
}
const STATUSES = ['Present', 'Absent', 'Late', 'Excused']

type AttSummary = {
  course_name: string
  total: number
  present: number
  absent: number
  late: number
  attendance_pct: number
}

function StudentView({ token }: { token: string }) {
  const [summary, setSummary] = useState<AttSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyAttendanceSummary(token)
      .then(res => setSummary((res.summary || []) as AttSummary[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <div className="h-48 animate-pulse bg-border rounded-xl" />

  if (summary.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckSquare className="h-10 w-10 text-border mx-auto mb-3" />
        <p className="text-sm text-muted">No attendance records yet. Your instructor will add sessions.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {summary.map((s, i) => {
        const pct = s.attendance_pct
        const low = pct < 75
        return (
          <div key={i} className={`rounded-xl border p-4 ${low ? 'border-red-300 bg-red-50' : 'border-border bg-card'}`}>
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-sm text-text-primary">{s.course_name}</h3>
              {low && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
            </div>
            <div className="mt-2 mb-1">
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>{s.present}/{s.total} classes</span>
                <span className={`font-semibold ${low ? 'text-red-600' : 'text-emerald-600'}`}>{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-border">
                <div
                  className={`h-2 rounded-full transition-all ${low ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-2 text-xs text-muted">
              <span className="text-emerald-700">Present: {s.present}</span>
              <span className="text-red-700">Absent: {s.absent}</span>
              <span className="text-amber-700">Late: {s.late}</span>
            </div>
            {low && <p className="text-xs text-red-600 mt-2 font-medium">Warning: Attendance below 75%</p>}
          </div>
        )
      })}
    </div>
  )
}

function TeacherView({ token }: { token: string }) {
  const [courses, setCourses] = useState<ManualCourse[]>([])
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [sessionTitle, setSessionTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sessionResult, setSessionResult] = useState<{ session: object; records: AttendanceRecord[] } | null>(null)
  const [statusMap, setStatusMap] = useState<Record<number, string>>({})
  const [savedSession, setSavedSession] = useState(false)

  useEffect(() => {
    getManualCourses(token)
      .then(res => setCourses(res.courses || []))
      .catch(() => {})
  }, [token])

  async function startSession() {
    if (!selectedCourse) { setError('Select a course first'); return }
    setSaving(true)
    setError('')
    try {
      const res = await createAttendanceSession(token, {
        manual_course_id: selectedCourse,
        session_date: sessionDate,
        session_title: sessionTitle || undefined,
        topic: topic || undefined,
      })
      const initMap: Record<number, string> = {}
      for (const r of res.records) {
        initMap[r.student_id] = r.status
      }
      setStatusMap(initMap)
      setSessionResult(res)
      setSavedSession(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start session')
    }
    setSaving(false)
  }

  async function saveRecord(sessionId: number, studentId: number, status: string) {
    setStatusMap(prev => ({ ...prev, [studentId]: status }))
    try {
      await updateAttendanceRecord(token, sessionId, studentId, status)
    } catch {}
  }

  const inputClass = 'w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none'

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-4 space-y-3">
        <h3 className="font-semibold text-sm text-text-primary">Take Attendance</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Course</label>
            <select
              className={inputClass}
              value={selectedCourse ?? ''}
              onChange={e => setSelectedCourse(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select course...</option>
              {courses.map(c => (
                <option key={c.manual_course_id} value={c.manual_course_id}>{c.course_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Date</label>
            <input type="date" className={inputClass} value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Session Title</label>
            <input className={inputClass} value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} placeholder="Lecture 5" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Topic</label>
            <input className={inputClass} value={topic} onChange={e => setTopic(e.target.value)} placeholder="Normalization" />
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          onClick={startSession}
          disabled={saving || !selectedCourse}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {saving ? 'Starting…' : 'Start Session'}
        </button>
      </div>

      {sessionResult && (
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-text-primary">Mark Attendance</h3>
            {savedSession && <span className="text-xs text-emerald-600 font-medium">Saved</span>}
          </div>
          <div className="space-y-2">
            {sessionResult.records.map((r) => {
              const student = (r as Record<string, unknown>).student as Record<string, string> | undefined
              const name = student ? `${student.first_name} ${student.last_name}` : `Student ${r.student_id}`
              const roll = student?.student_roll
              const currentStatus = statusMap[r.student_id] || 'Present'
              const session = sessionResult.session as Record<string, number>

              return (
                <div key={r.student_id} className="flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{name}</p>
                    {roll && <p className="text-xs text-muted">{roll}</p>}
                  </div>
                  <div className="flex gap-1">
                    {STATUSES.map(s => (
                      <button
                        key={s}
                        onClick={() => saveRecord(session.session_id, r.student_id, s)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          currentStatus === s ? STATUS_STYLES[s] : 'bg-border text-muted hover:bg-accent/10'
                        }`}
                      >
                        {s.charAt(0)}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          {sessionResult.records.length === 0 && (
            <p className="text-sm text-muted text-center py-4">No enrolled students found for this course.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function AttendanceTab({ token, role }: Props) {
  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-semibold text-text-primary mb-4">Attendance</h2>
      {role === 'teacher' ? <TeacherView token={token} /> : <StudentView token={token} />}
    </div>
  )
}
