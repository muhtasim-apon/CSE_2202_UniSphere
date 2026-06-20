'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, CheckSquare, FileText, BarChart3, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ManualCoursesTab from './components/ManualCoursesTab'
import AttendanceTab from './components/AttendanceTab'
import ExamMarksTab from './components/ExamMarksTab'
import CGPAView from './components/CGPAView'
import InvitePopup from './components/InvitePopup'
import { getCourseByJoinToken, joinByToken, type ManualCourse } from '@/app/lib/classesApi'

type Props = {
  userId: string
  role: 'teacher' | 'student'
}

const ALL_TABS = [
  { id: 'courses',    label: 'My Courses', icon: BookOpen },
  { id: 'attendance', label: 'Attendance', icon: CheckSquare },
  { id: 'exams',      label: 'Exam Marks', icon: FileText },
  { id: 'cgpa',       label: 'My CGPA',    icon: BarChart3 },
]

type JoinCoursePreview = {
  course_name: string
  course_code: string | null
  semester: string | null
  credit_hours: number
  instructor_name: string
}

function EmptyCourseState() {
  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="text-center py-16">
        <BookOpen className="h-12 w-12 text-border mx-auto mb-3" />
        <p className="text-sm font-medium text-text-primary">No course selected</p>
        <p className="text-xs text-muted mt-1">
          Go to <strong>My Courses</strong> and click a course to view attendance and exams.
        </p>
      </div>
    </div>
  )
}

export default function ClassesClient({ userId, role }: Props) {
  const [activeTab, setActiveTab] = useState('courses')
  const [token, setToken] = useState<string | null>(null)
  const [coursesKey, setCoursesKey] = useState(0)
  const [selectedCourse, setSelectedCourse] = useState<ManualCourse | null>(null)
  const [cgpaKey, setCgpaKey] = useState(0)

  const [joinToken, setJoinToken] = useState<string | null>(null)
  const [joinPreview, setJoinPreview] = useState<JoinCoursePreview | null>(null)
  const [joinLoading, setJoinLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinMsg, setJoinMsg] = useState<string | null>(null)

  const TABS = role === 'teacher' ? ALL_TABS.filter(t => t.id !== 'cgpa') : ALL_TABS

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null)
    })
  }, [])

  useEffect(() => {
    if (!token || role !== 'student') return
    const params = new URLSearchParams(window.location.search)
    const jt = params.get('join')
    if (jt) {
      setJoinToken(jt)
      window.history.replaceState({}, '', '/dashboard/classes')
      setJoinLoading(true)
      getCourseByJoinToken(token, jt)
        .then(data => setJoinPreview(data as JoinCoursePreview))
        .catch(() => setJoinMsg('Course not found or no longer active.'))
        .finally(() => setJoinLoading(false))
    }
  }, [token, role])

  async function handleJoinConfirm() {
    if (!token || !joinToken) return
    setJoining(true)
    try {
      const res = await joinByToken(token, joinToken)
      setJoinMsg(`You joined ${(res as Record<string, unknown>).course_name}!`)
      setJoinToken(null)
      setJoinPreview(null)
      setCoursesKey(k => k + 1)
    } catch (e: unknown) {
      setJoinMsg(e instanceof Error ? e.message : 'Failed to join course')
    }
    setJoining(false)
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <div className="h-10 animate-pulse rounded-xl bg-border w-96" />
        <div className="h-64 animate-pulse rounded-card bg-border" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {role === 'student' && (
        <InvitePopup token={token} onCourseJoined={() => setCoursesKey(k => k + 1)} />
      )}

      <AnimatePresence>
        {(joinToken || joinMsg) && role === 'student' && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl"
              initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            >
              <button
                onClick={() => { setJoinToken(null); setJoinPreview(null); setJoinMsg(null) }}
                className="absolute right-4 top-4 text-muted hover:text-primary"
              >
                <X className="h-5 w-5" />
              </button>

              {joinMsg ? (
                <div className="text-center py-2">
                  <p className={`text-sm font-medium ${joinMsg.includes('joined') ? 'text-emerald-600' : 'text-red-500'}`}>{joinMsg}</p>
                  <button onClick={() => setJoinMsg(null)} className="mt-4 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition">OK</button>
                </div>
              ) : joinLoading ? (
                <div className="text-center py-4">
                  <div className="h-6 w-32 animate-pulse bg-border rounded mx-auto mb-2" />
                  <p className="text-sm text-muted">Loading course info…</p>
                </div>
              ) : joinPreview ? (
                <>
                  <h2 className="font-display text-lg font-bold text-text-primary mb-1">Join Class</h2>
                  <div className="rounded-xl border border-border bg-background p-4 mb-4 space-y-1.5">
                    <p className="font-semibold text-text-primary">{joinPreview.course_name}</p>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {joinPreview.course_code && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">{joinPreview.course_code}</span>}
                      {joinPreview.semester && <span className="rounded-full bg-border px-2 py-0.5 text-muted">{joinPreview.semester}</span>}
                      {joinPreview.credit_hours && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-accent">{joinPreview.credit_hours} Credits</span>}
                    </div>
                    <p className="text-xs text-muted">Instructor: {joinPreview.instructor_name}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setJoinToken(null); setJoinPreview(null) }}
                      className="flex-1 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted hover:border-primary hover:text-primary transition"
                    >Cancel</button>
                    <button
                      onClick={handleJoinConfirm}
                      disabled={joining}
                      className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-60"
                    >
                      {joining ? 'Joining…' : 'Join This Class →'}
                    </button>
                  </div>
                </>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="bg-gradient-to-r from-primary via-secondary to-accent rounded-xl px-5 py-4 text-white mb-4">
          <h1 className="text-xl font-bold font-display">Classes</h1>
          <p className="text-sm opacity-80 mt-0.5">Manage your courses, attendance, and academic performance</p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-background p-1 w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-primary'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeTab}-${coursesKey}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'courses' && (
            <ManualCoursesTab
              key={coursesKey}
              token={token}
              role={role}
              userId={userId}
              onCourseSelect={setSelectedCourse}
            />
          )}
          {activeTab === 'attendance' && (
            selectedCourse ? (
              <AttendanceTab
                token={token}
                role={role}
                courseId={selectedCourse.manual_course_id}
                courseName={selectedCourse.course_name}
              />
            ) : <EmptyCourseState />
          )}
          {activeTab === 'exams' && (
            selectedCourse ? (
              <ExamMarksTab
                token={token}
                role={role}
                userId={userId}
                courseId={selectedCourse.manual_course_id}
                courseName={selectedCourse.course_name}
                courseCode={selectedCourse.course_code}
                creditHours={selectedCourse.credit_hours}
                onMarkSaved={() => setCgpaKey(k => k + 1)}
              />
            ) : <EmptyCourseState />
          )}
          {activeTab === 'cgpa' && (
            <CGPAView token={token} role={role} refreshKey={cgpaKey} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
