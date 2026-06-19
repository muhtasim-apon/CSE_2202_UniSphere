'use client'

import { useState, useEffect } from 'react'
import { BarChart3, RefreshCw, CheckCircle2 } from 'lucide-react'
import { getCGPA, recalculateCGPA, type CGPAResult } from '@/app/lib/classesApi'

type Props = {
  token: string
  role: 'teacher' | 'student'
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

export default function CGPAView({ token, role }: Props) {
  const [data, setData] = useState<CGPAResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [updateMsg, setUpdateMsg] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getCGPA(token)
      setData(res)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (role === 'teacher') {
    return (
      <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="text-center py-10">
          <BarChart3 className="h-10 w-10 text-border mx-auto mb-3" />
          <p className="text-sm text-muted">CGPA view is for students only.</p>
        </div>
      </div>
    )
  }

  const handleRecalc = async () => {
    setRecalculating(true)
    setUpdateMsg(null)
    try {
      const res = await recalculateCGPA(token)
      setData(res)
      setUpdateMsg(`Profile CGPA updated to ${res.new_cgpa.toFixed(2)}`)
    } catch {
      setUpdateMsg('Failed to update. Please try again.')
    }
    setRecalculating(false)
  }

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

  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-semibold text-text-primary mb-5">My CGPA</h2>

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
          <div className="flex gap-2 mt-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted hover:border-primary hover:text-primary transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Recalculate
            </button>
            <button
              onClick={handleRecalc}
              disabled={recalculating}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition disabled:opacity-60"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {recalculating ? 'Updating…' : 'Update Profile CGPA'}
            </button>
          </div>
          {updateMsg && (
            <p className={`text-xs mt-1 ${updateMsg.includes('Failed') ? 'text-red-600' : 'text-emerald-600'} font-medium`}>
              {updateMsg.includes('Failed') ? '' : '✓ '}{updateMsg}
            </p>
          )}
        </div>
      </div>

      {data && data.breakdown.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Exam Breakdown</h3>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Exam</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Marks</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Grade</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">GP</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wide">Credits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.breakdown.map((row, i) => {
                  const gradeColor = !row.grade ? '' :
                    row.grade.startsWith('A') ? 'text-emerald-600' :
                    row.grade.startsWith('B') ? 'text-blue-600' :
                    row.grade.startsWith('C') ? 'text-amber-600' :
                    row.grade === 'F' ? 'text-red-600' : ''
                  return (
                    <tr key={i} className="hover:bg-background/50 transition">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-text-primary">{row.exam_name || '—'}</div>
                        {row.exam_type && <div className="text-xs text-muted">{row.exam_type}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-muted">
                        {row.marks_obtained !== null ? `${row.marks_obtained}/${row.total_marks}` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`font-semibold ${gradeColor}`}>{row.grade || '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{row.grade_points?.toFixed(2) ?? '—'}</td>
                      <td className="px-4 py-2.5 text-muted">{row.credit_hours ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && data.breakdown.length === 0 && (
        <div className="text-center py-8 text-sm text-muted">
          No exam marks found. Add exam marks in the Exam Marks tab to calculate your CGPA.
        </div>
      )}
    </div>
  )
}
