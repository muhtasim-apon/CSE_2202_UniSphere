'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Users, UserMinus, Search, UserPlus } from 'lucide-react'
import { getCourseStudents, removeStudentFromCourse, type CourseStudent } from '@/app/lib/classesApi'
import AddStudentsModal from './AddStudentsModal'

type Props = {
  token: string
  courseId: number
  joinLinkToken: string
  role: 'teacher' | 'student'
}

export default function StudentsPanel({ token, courseId, joinLinkToken, role }: Props) {
  const [students, setStudents] = useState<CourseStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [removing, setRemoving] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getCourseStudents(token, courseId)
      setStudents(res.students || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [courseId])

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    return !q || `${s.first_name} ${s.last_name} ${s.student_roll}`.toLowerCase().includes(q)
  })

  async function handleRemove(studentId: number) {
    if (!confirm('Remove this student from the course? Their attendance history will be preserved.')) return
    setRemoving(studentId)
    try {
      await removeStudentFromCourse(token, courseId, studentId)
      setStudents(prev => prev.filter(s => s.student_id !== studentId))
    } catch {}
    setRemoving(null)
  }

  function initials(first: string, last: string) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted" />
          <span className="text-sm font-semibold text-text-primary">{students.length} students enrolled</span>
        </div>
        {role === 'teacher' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-cta px-3 py-1.5 text-xs font-semibold text-cta-text hover:opacity-90 transition"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add Students
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search students..."
          className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2.5 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-border" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Users className="h-8 w-8 text-border mx-auto mb-2" />
          <p className="text-sm text-muted">{search ? 'No students match your search.' : 'No students enrolled yet.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {filtered.map(s => (
              <motion.div
                key={s.student_id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-accent/40 transition"
              >
                <div className="h-9 w-9 rounded-full bg-cta flex items-center justify-center text-xs font-bold text-cta-text flex-shrink-0">
                  {initials(s.first_name, s.last_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {s.first_name} {s.last_name}
                  </p>
                  <p className="text-xs text-muted">{s.student_roll}</p>
                </div>
                {s.email && (
                  <a href={`mailto:${s.email}`} className="text-muted hover:text-accent transition flex-shrink-0 text-xs truncate max-w-[140px] hidden sm:block">
                    {s.email}
                  </a>
                )}
                <span className="text-xs text-muted flex-shrink-0 hidden md:block">
                  {new Date(s.enrolled_at).toLocaleDateString()}
                </span>
                {role === 'teacher' && (
                  <button
                    onClick={() => handleRemove(s.student_id)}
                    disabled={removing === s.student_id}
                    className="flex-shrink-0 text-red-400 hover:text-red-600 transition disabled:opacity-50"
                    title="Remove student"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <AddStudentsModal
            token={token}
            courseId={courseId}
            joinLinkToken={joinLinkToken}
            onClose={() => setShowAddModal(false)}
            onStudentAdded={load}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
