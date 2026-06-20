'use client'

import { useState, useEffect } from 'react'
import { BarChart3 } from 'lucide-react'
import { getCGPA, type CGPAResult, type ExamBreakdown } from '@/app/lib/classesApi'

type Props = {
  token: string
  role: 'teacher' | 'student'
  refreshKey: number
}

function cgpaColor(cgpa: number): string {
  if (cgpa >= 3.75) return 'text-emerald-600'
  if (cgpa >= 3.50) return 'text-blue-600'
  if (cgpa >= 3.00) return 'text-indigo-600'
  if (cgpa >= 2.50) return 'text-amber-600'
  return 'text-red-600'
}

function cgpaLabel(cgpa: number): string {
  if (cgpa >= 3.75) return 'Excellent'
  if (cgpa >= 3.50) return 'Very Good'
  if (cgpa >= 3.00) return 'Good'
  if (cgpa >= 2.50) return 'Average'
  return 'Below Average'
}

function gradeColor(grade: string | null): string {
  if (!grade) return ''
  if (grade.startsWith('A')) return 'text-emerald-600'
  if (grade.startsWith('B')) return 'text-blue-600'
  if (grade.startsWith('C')) return 'text-amber-600'
  if (grade === 'D') return 'text-orange-600'
  if (grade === 'F') return 'text-red-600'
  return ''
}

function groupByCourse(breakdown: ExamBreakdown[]): Map<string, ExamBreakdown[]> {
  const map = new Map<string, ExamBreakdown[]>()
  for (const row of breakdown) {
    const key = row.course_name ?? 'Standalone / No Course'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(row)
  }
  return map
}

export default function CGPAView({ token, role, refreshKey }: Props) {
  const [data, setData] = useState<CGPAResult | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getCGPA(token)
      setData(res)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (refreshKey > 0) load() }, [refreshKey])

  if (role === 'teacher') return null

  if (loading) {
    return (
      <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="h-48 animate-pulse bg-border rounded-xl" />
      </div>
    )
  }

  const cgpa = data?.cgpa ?? 0
  const color = cgpaColor(cgpa)
  const label = cgpaLabel(cgpa)
  const grouped = data ? groupByCourse(data.breakdown) : new Map<string, ExamBreakdown[]>()

  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-semibold text-text-primary mb-1">My CGPA</h2>
      <p className="text-xs text-muted mb-5">
        Auto-updated after each exam mark entry · DU grading scale: A+(4.00) A(3.75) A-(3.50) B+(3.25) B(3.00) B-(2.75) C+(2.50) C(2.25) D(2.00) F(0.00)
      </p>

      <div className="flex flex-col sm:flex-row gap-6 mb-6">
        <div className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl border-2 border-border bg-background p-6 w-40">
          <span className={`text-4xl font-bold font-display ${color}`}>{cgpa.toFixed(2)}</span>
          <span className={`text-sm font-semibold mt-1 ${color}`}>{label}</span>
        </div>
        <div className="flex flex-col justify-center gap-2">
          <p className="text-sm text-muted">
            Calculated from <span className="font-semibold text-text-primary">{data?.exam_count ?? 0}</span> exam{(data?.exam_count ?? 0) !== 1 ? 's' : ''}
          </p>
          <p className="text-sm text-muted">
            Total Credits: <span className="font-semibold text-text-primary">{data?.total_credits?.toFixed(1) ?? '0.0'}</span>
          </p>
          <p className="text-sm text-muted">
            Total Points: <span className="font-semibold text-text-primary">{data?.total_points?.toFixed(2) ?? '0.00'}</span>
          </p>
        </div>
      </div>

      {data && data.breakdown.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Exam Breakdown</h3>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Course</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Exam</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Marks</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Grade</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">GP</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Credits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Array.from(grouped.entries()).map(([courseName, rows]) => (
                  rows.map((row, i) => (
                    <tr key={`${courseName}-${i}`} className="hover:bg-background/50 transition">
                      {i === 0 && (
                        <td className="px-4 py-2.5" rowSpan={rows.length}>
                          <div className="font-medium text-text-primary text-xs">{courseName}</div>
                          {rows[0].course_code && (
                            <div className="text-[11px] text-muted">{rows[0].course_code}</div>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-text-primary">{row.exam_name || '—'}</div>
                        {row.exam_type && <div className="text-xs text-muted">{row.exam_type}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-muted">
                        {row.marks_obtained !== null ? `${row.marks_obtained}/${row.total_marks}` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`font-semibold ${gradeColor(row.grade)}`}>{row.grade || '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{row.grade_points?.toFixed(2) ?? '—'}</td>
                      <td className="px-4 py-2.5 text-muted">{row.credit_hours ?? '—'}</td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-sm text-muted">
          <BarChart3 className="h-10 w-10 text-border mx-auto mb-3" />
          No exam marks found. Add exam marks in the Exam Marks tab to calculate your CGPA.
        </div>
      )}
    </div>
  )
}
