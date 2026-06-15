'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  validateDeptName,
  validateDeptCode,
  validateProgramName,
  validateProgramCode,
  validateRegistrationNo,
  validateEmployeeId,
  validateBatchYear,
  validateDateOfBirth,
  validatePhone,
  validateAddress,
  validateBio,
  validateName,
} from '@/lib/validation'

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20'

const labelClass = 'mb-1 block text-sm font-medium text-text-primary'

type OnboardingFormProps = {
  role: 'student' | 'instructor'
}

const DEGREE_LEVELS = ['Certificate', 'Diploma', 'Associate', 'Bachelor', 'Master', 'PhD'] as const
const DESIGNATIONS = [
  'Lecturer', 'Assistant Professor', 'Associate Professor', 'Professor', 'Adjunct', 'Visiting',
] as const

export default function OnboardingForm({ role }: OnboardingFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Shared
  const [deptName, setDeptName] = useState('')
  const [deptCode, setDeptCode] = useState('')
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [phone, setPhone] = useState('')

  // Student
  const [programName, setProgramName] = useState('')
  const [programCode, setProgramCode] = useState('')
  const [degreeLevel, setDegreeLevel] = useState<typeof DEGREE_LEVELS[number]>('Bachelor')
  const [durationYears, setDurationYears] = useState('4')
  const [totalCredits, setTotalCredits] = useState('160')
  const [registrationNo, setRegistrationNo] = useState('')
  const [batchYear, setBatchYear] = useState(String(new Date().getFullYear()))
  const [address, setAddress] = useState('')
  const [emergencyContactName, setEmergencyContactName] = useState('')
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('')

  // Instructor
  const [employeeId, setEmployeeId] = useState('')
  const [designation, setDesignation] = useState<typeof DESIGNATIONS[number]>('Lecturer')
  const [officeLocation, setOfficeLocation] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [bio, setBio] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const errors = [
      validateDeptName(deptName) && `Department name: ${validateDeptName(deptName)}`,
      validateDeptCode(deptCode) && `Department code: ${validateDeptCode(deptCode)}`,
      validatePhone(phone) && `Phone: ${validatePhone(phone)}`,
    ].filter(Boolean) as string[]

    let payload: Record<string, unknown> = {
      dept_name: deptName.trim(),
      dept_code: deptCode.trim().toUpperCase(),
      gender,
      phone: phone || null,
    }

    if (role === 'student') {
      errors.push(
        ...([
          validateProgramName(programName) && `Program name: ${validateProgramName(programName)}`,
          validateProgramCode(programCode) && `Program code: ${validateProgramCode(programCode)}`,
          validateRegistrationNo(registrationNo) && `Registration No: ${validateRegistrationNo(registrationNo)}`,
          validateBatchYear(batchYear) && `Batch year: ${validateBatchYear(batchYear)}`,
          validateDateOfBirth(dateOfBirth, 15) && `Date of birth: ${validateDateOfBirth(dateOfBirth, 15)}`,
          validateAddress(address) && `Address: ${validateAddress(address)}`,
          emergencyContactName && validateName(emergencyContactName) && `Emergency contact name: ${validateName(emergencyContactName)}`,
          validatePhone(emergencyContactPhone) && `Emergency contact phone: ${validatePhone(emergencyContactPhone)}`,
        ].filter(Boolean) as string[])
      )

      payload = {
        ...payload,
        program_name: programName.trim(),
        program_code: programCode.trim().toUpperCase(),
        degree_level: degreeLevel,
        duration_years: Number(durationYears),
        total_credits: Number(totalCredits),
        student_roll: registrationNo.trim(),
        batch_year: Number(batchYear),
        date_of_birth: dateOfBirth,
        address: address || null,
        emergency_contact_name: emergencyContactName || null,
        emergency_contact_phone: emergencyContactPhone || null,
      }
    } else {
      errors.push(
        ...([
          validateEmployeeId(employeeId) && `Employee ID: ${validateEmployeeId(employeeId)}`,
          dateOfBirth && validateDateOfBirth(dateOfBirth, 22) && `Date of birth: ${validateDateOfBirth(dateOfBirth, 22)}`,
          validateBio(bio) && `Bio: ${validateBio(bio)}`,
        ].filter(Boolean) as string[])
      )

      payload = {
        ...payload,
        employee_id: employeeId.trim().toUpperCase(),
        designation,
        date_of_birth: dateOfBirth || null,
        office_location: officeLocation || null,
        specialization: specialization || null,
        bio: bio || null,
      }
    }

    if (errors.length > 0) {
      setError(errors.join(', '))
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      setSubmitting(false)
      setError('Your session has expired. Please sign in again.')
      return
    }

    const endpoint = role === 'instructor' ? '/api/onboarding/instructor' : '/api/onboarding/student'

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    })

    setSubmitting(false)

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setError(body?.detail ?? 'Something went wrong. Please try again.')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Department Name</label>
          <input className={inputClass} value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="Computer Science & Engineering" required />
        </div>
        <div>
          <label className={labelClass}>Department Code</label>
          <input className={inputClass} value={deptCode} onChange={(e) => setDeptCode(e.target.value.toUpperCase())} placeholder="CSE" required />
        </div>
      </div>

      {role === 'student' ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Program Name</label>
              <input className={inputClass} value={programName} onChange={(e) => setProgramName(e.target.value)} placeholder="B.Sc. in Computer Science & Engineering" required />
            </div>
            <div>
              <label className={labelClass}>Program Code</label>
              <input className={inputClass} value={programCode} onChange={(e) => setProgramCode(e.target.value.toUpperCase())} placeholder="CSE-BSC" required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Degree Level</label>
              <select className={inputClass} value={degreeLevel} onChange={(e) => setDegreeLevel(e.target.value as typeof DEGREE_LEVELS[number])}>
                {DEGREE_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Duration (years)</label>
              <input className={inputClass} type="number" step="0.5" min="0.5" max="8" value={durationYears} onChange={(e) => setDurationYears(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>Total Credits</label>
              <input className={inputClass} type="number" min="1" max="300" value={totalCredits} onChange={(e) => setTotalCredits(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Registration No</label>
              <input
                className={inputClass}
                value={registrationNo}
                onChange={(e) => setRegistrationNo(e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                placeholder="2023010123"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Batch Year</label>
              <input className={inputClass} type="number" value={batchYear} onChange={(e) => setBatchYear(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Gender</label>
              <select className={inputClass} value={gender} onChange={(e) => setGender(e.target.value as 'Male' | 'Female' | 'Other')}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Date of Birth</label>
              <input className={inputClass} type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className={labelClass}>Phone (optional)</label>
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
          </div>

          <div>
            <label className={labelClass}>Address (optional)</label>
            <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Emergency Contact Name (optional)</label>
              <input className={inputClass} value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Emergency Contact Phone (optional)</label>
              <input className={inputClass} value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="01XXXXXXXXX" />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Employee ID</label>
              <input className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value.toUpperCase())} placeholder="EMP-001" required />
            </div>
            <div>
              <label className={labelClass}>Designation</label>
              <select className={inputClass} value={designation} onChange={(e) => setDesignation(e.target.value as typeof DESIGNATIONS[number])}>
                {DESIGNATIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Gender</label>
              <select className={inputClass} value={gender} onChange={(e) => setGender(e.target.value as 'Male' | 'Female' | 'Other')}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Date of Birth (optional)</label>
              <input className={inputClass} type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Phone (optional)</label>
              <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
            </div>
            <div>
              <label className={labelClass}>Office Location (optional)</label>
              <input className={inputClass} value={officeLocation} onChange={(e) => setOfficeLocation(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Specialization (optional)</label>
            <input className={inputClass} value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>Bio (optional)</label>
            <textarea className={inputClass} rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
        </>
      )}

      {error && (
        <p className="rounded-lg bg-notification/10 px-3 py-2 text-sm text-notification">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-lg bg-cta px-4 py-2.5 text-sm font-semibold text-cta-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Saving...' : 'Continue to Dashboard'}
      </button>
    </form>
  )
}
