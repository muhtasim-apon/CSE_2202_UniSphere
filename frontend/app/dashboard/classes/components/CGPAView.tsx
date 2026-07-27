'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart3, ChevronDown, ChevronUp, GraduationCap, Clock } from 'lucide-react'
import {
  getCGPA,
  MARK_HEAD_LABELS,
  MIN_GRADUATION_CGPA,
  REQUIRED_CREDITS,
  type CGPAResult,
  type CourseResult,
  type IncompleteCourse,
  type MarkHead,
} from '@/app/lib/classesApi'

type Props = {
  token: string
  role: 'teacher' | 'student'
  refreshKey: number
}

function cgpaColor(cgpa: number): string {
  if (cgpa >= 3.75) return 'text-emerald-600 dark:text-emerald-300'
  if (cgpa >= 3.50) return 'text-blue-600 dark:text-blue-300'
  if (cgpa >= 3.00) return 'text-indigo-600 dark:text-indigo-300'
  if (cgpa >= 2.50) return 'text-amber-600 dark:text-amber-300'
  return 'text-red-600 dark:text-red-300'
}

function cgpaLabel(cgpa: number): string {
  if (cgpa >= 3.75) return 'Excellent'
  if (cgpa >= 3.50) return 'Very Good'
  if (cgpa >= 3.00) return 'Good'
  if (cgpa >= 2.50) return 'Average'
  return 'Below Average'
}

function gradeChipClass(grade: string): string {
  if (grade.startsWith('A')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
  if (grade.startsWith('B')) return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
  if (grade.startsWith('C')) return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
  if (grade === 'D') return 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300'
  if (grade === 'W' || grade === 'I') return 'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300'
  return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
}

function HeadBreakdown({ heads }: { heads: MarkHead[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">Mark Head</th>
          <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted">Weight</th>
          <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted">Obtained</th>
          <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted">Contribution</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/50">
        {heads.map(h => (
          <tr key={h.head} className={h.contribution === null ? 'opacity-50' : ''}>
            <td className="px-4 py-2 text-text-primary">{MARK_HEAD_LABELS[h.head] ?? h.head}</td>
            <td className="px-4 py-2 text-right text-muted">{h.weight}</td>
            <td className="px-4 py-2 text-right text-muted">
              {h.obtained === null ? <span className="italic">not marked</span> : `${h.obtained}/${h.total}`}
            </td>
            <td className="px-4 py-2 text-right font-medium text-text-primary">
              {h.contribution === null ? '—' : h.contribution.toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CourseRow({ course }: { course: CourseResult }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent/5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">{course.course_name}</p>
            {course.course_code && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {course.course_code}
              </span>
            )}
            <span className="rounded-full bg-border px-2 py-0.5 text-xs capitalize text-muted">
              {course.course_type}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {course.credit_hours} credits · {course.course_pct.toFixed(2)}/100 · GP {course.grade_points.toFixed(2)}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${gradeChipClass(course.grade)}`}>
          {course.grade}
        </span>
        {open ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted" /> : <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted" />}
      </button>
      {open && (
        <div className="border-t border-border bg-background">
          <HeadBreakdown heads={course.heads} />
        </div>
      )}
    </div>
  )
}

function IncompleteRow({ course }: { course: IncompleteCourse }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-dashed border-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent/5"
      >
        <Clock className="h-4 w-4 flex-shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-text-primary">{course.course_name}</p>
            {course.course_code && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {course.course_code}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {course.credit_hours} credits · {course.provisional_pct.toFixed(2)}/100 so far
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-500/15 dark:text-gray-300">
          In progress
        </span>
        {open ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted" /> : <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted" />}
      </button>
      {open && (
        <div className="border-t border-border bg-background">
          <HeadBreakdown heads={course.heads} />
        </div>
      )}
    </div>
  )
}

export default function CGPAView({ token, role, refreshKey }: Props) {
  const [data, setData] = useState<CGPAResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      setData(await getCGPA(token))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load CGPA.')
    }
    setLoading(false)
  }, [token])

  // `token` must be a dependency — it arrives after mount, and without it the
  // view would stay empty forever.
  useEffect(() => { load() }, [load, refreshKey])

  if (role === 'teacher') return null

  if (loading) {
    return (
      <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="h-48 animate-pulse rounded-xl bg-border" />
      </div>
    )
  }

  const cgpa = data?.cgpa ?? 0
  const earned = data?.total_credits_earned ?? 0
  const semesters = data?.semesters ?? []
  const incomplete = data?.incomplete_courses ?? []
  const progressPct = Math.min((earned / REQUIRED_CREDITS) * 100, 100)
  const meetsCgpa = cgpa >= MIN_GRADUATION_CGPA
  const fCount = data?.f_grade_count ?? 0

  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-1 text-base font-semibold text-text-primary">My CGPA</h2>
      <p className="mb-5 text-xs text-muted">
        Graded per course on the DU curriculum scale — each course is scored out of 100 from its
        weighted mark heads, then <span className="font-mono">CGPA = Σ Cᵢ·Gᵢ / Σ Cᵢ</span>.
      </p>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mb-6 flex flex-col gap-6 sm:flex-row">
        <div className="flex w-40 flex-shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-border bg-background p-6">
          <span className={`font-display text-4xl font-bold ${cgpaColor(cgpa)}`}>{cgpa.toFixed(2)}</span>
          <span className={`mt-1 text-sm font-semibold ${cgpaColor(cgpa)}`}>{cgpaLabel(cgpa)}</span>
        </div>
        <div className="flex flex-col justify-center gap-2">
          <p className="text-sm text-muted">
            Completed courses: <span className="font-semibold text-text-primary">{data?.course_count ?? 0}</span>
          </p>
          <p className="text-sm text-muted">
            Credits earned:{' '}
            <span className="font-semibold text-text-primary">{earned.toFixed(1)}</span>
            {' of '}{REQUIRED_CREDITS}
          </p>
          <p className="text-sm text-muted">
            Credits attempted:{' '}
            <span className="font-semibold text-text-primary">
              {(data?.total_credits_attempted ?? 0).toFixed(1)}
            </span>
          </p>
        </div>
      </div>

      {/* Graduation progress (§7h, §7i) */}
      <div className="mb-6 rounded-xl border border-border bg-background p-4">
        <div className="mb-2 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-text-primary">Graduation Progress</p>
        </div>
        <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="text-muted">{earned.toFixed(1)} / {REQUIRED_CREDITS} credits ({progressPct.toFixed(0)}%)</span>
          <span className={meetsCgpa ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}>
            {meetsCgpa ? '✓' : '⚠'} CGPA ≥ {MIN_GRADUATION_CGPA.toFixed(2)}
          </span>
          <span className={fCount === 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}>
            {fCount === 0 ? '✓ No F grades' : `⚠ ${fCount} F grade${fCount === 1 ? '' : 's'} to clear`}
          </span>
        </div>
      </div>

      {semesters.length > 0 ? (
        <div className="space-y-5">
          {semesters.map(sem => (
            <div key={sem.semester_number ?? 'unassigned'}>
              <div className="mb-2 flex items-center gap-3">
                <h3 className="text-sm font-semibold text-text-primary">
                  {sem.semester_number ? `Semester ${sem.semester_number}` : 'Unassigned semester'}
                </h3>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  SGPA {sem.sgpa.toFixed(2)}
                </span>
                <span className="text-xs text-muted">{sem.credits.toFixed(1)} credits</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                {sem.courses.map(c => <CourseRow key={c.course_id} course={c} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-muted">
          <BarChart3 className="mx-auto mb-3 h-10 w-10 text-border" />
          No completed courses yet. A course counts toward your CGPA once its final exam is marked.
        </div>
      )}

      {incomplete.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-sm font-semibold text-text-primary">In Progress</h3>
            <div className="h-px flex-1 bg-border" />
          </div>
          <p className="mb-2 text-xs text-muted">
            Not yet counted toward CGPA — the semester final has not been marked.
          </p>
          <div className="space-y-2">
            {incomplete.map(c => <IncompleteRow key={c.course_id} course={c} />)}
          </div>
        </div>
      )}
    </div>
  )
}
