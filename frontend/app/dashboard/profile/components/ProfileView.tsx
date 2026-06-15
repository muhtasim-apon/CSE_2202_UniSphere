'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, User, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ModuleCard from '../../components/ModuleCard'
import ProfilePhotoUpload from './ProfilePhotoUpload'
import { validateName, validatePhone, validateAddress, validateBio, toLocalPhone } from '@/lib/validation'

type Gender = 'Male' | 'Female' | 'Other'

type StudentProfile = {
  profile_id: string
  role: string
  first_name: string
  last_name: string
  gender: Gender | null
  date_of_birth: string | null
  phone: string | null
  address: string | null
  student_roll: string
  batch_year: number
  current_semester: number
  cgpa: number
  total_credits: number
  profile_photo: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  is_active: boolean
  account_created_at: string
  program_name: string
  dept_name: string
}

type InstructorProfile = {
  profile_id: string
  role: string
  first_name: string
  last_name: string
  gender: Gender | null
  date_of_birth: string | null
  phone: string | null
  office_location: string | null
  employee_id: string
  hire_date: string
  designation: string
  specialization: string | null
  bio: string | null
  profile_photo: string | null
  is_active: boolean
  account_created_at: string
  dept_name: string
}

type ProfileViewProps =
  | { userId: string; role: 'student'; initialProfile: StudentProfile }
  | { userId: string; role: 'instructor'; initialProfile: InstructorProfile }

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20'

const labelClass = 'mb-1 block text-sm font-medium text-text-primary'

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-sm text-text-primary">{value}</p>
    </div>
  )
}

export default function ProfileView({ userId, role, initialProfile }: ProfileViewProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(initialProfile.profile_photo)

  const [firstName, setFirstName] = useState(initialProfile.first_name)
  const [lastName, setLastName] = useState(initialProfile.last_name)
  const [gender, setGender] = useState<Gender>(initialProfile.gender ?? 'Male')
  const [dateOfBirth, setDateOfBirth] = useState(initialProfile.date_of_birth ?? '')
  const [phone, setPhone] = useState(toLocalPhone(initialProfile.phone))

  // Student-only fields
  const student = role === 'student' ? (initialProfile as StudentProfile) : null
  const [address, setAddress] = useState(student?.address ?? '')
  const [emergencyContactName, setEmergencyContactName] = useState(student?.emergency_contact_name ?? '')
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(toLocalPhone(student?.emergency_contact_phone ?? null))

  // Instructor-only fields
  const instructor = role === 'instructor' ? (initialProfile as InstructorProfile) : null
  const [officeLocation, setOfficeLocation] = useState(instructor?.office_location ?? '')
  const [specialization, setSpecialization] = useState(instructor?.specialization ?? '')
  const [bio, setBio] = useState(instructor?.bio ?? '')

  const fullName = `${initialProfile.first_name} ${initialProfile.last_name}`
  const initials = `${initialProfile.first_name.charAt(0)}${initialProfile.last_name.charAt(0) || ''}`.toUpperCase()

  function cancelEdit() {
    setFirstName(initialProfile.first_name)
    setLastName(initialProfile.last_name)
    setGender(initialProfile.gender ?? 'Male')
    setDateOfBirth(initialProfile.date_of_birth ?? '')
    setPhone(toLocalPhone(initialProfile.phone))
    if (student) {
      setAddress(student.address ?? '')
      setEmergencyContactName(student.emergency_contact_name ?? '')
      setEmergencyContactPhone(toLocalPhone(student.emergency_contact_phone))
    }
    if (instructor) {
      setOfficeLocation(instructor.office_location ?? '')
      setSpecialization(instructor.specialization ?? '')
      setBio(instructor.bio ?? '')
    }
    setError(null)
    setSuccess(false)
    setEditing(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const errors = [
      validateName(firstName) && `First name: ${validateName(firstName)}`,
      validateName(lastName) && `Last name: ${validateName(lastName)}`,
      validatePhone(phone) && `Phone: ${validatePhone(phone)}`,
    ].filter(Boolean) as string[]

    let payload: Record<string, unknown> = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      gender,
      date_of_birth: dateOfBirth || null,
      phone: phone || null,
    }

    if (role === 'student') {
      errors.push(
        ...([
          validateAddress(address) && `Address: ${validateAddress(address)}`,
          emergencyContactName && validateName(emergencyContactName) && `Emergency contact name: ${validateName(emergencyContactName)}`,
          validatePhone(emergencyContactPhone) && `Emergency contact phone: ${validatePhone(emergencyContactPhone)}`,
        ].filter(Boolean) as string[])
      )

      payload = {
        ...payload,
        address: address || null,
        emergency_contact_name: emergencyContactName || null,
        emergency_contact_phone: emergencyContactPhone || null,
      }
    } else {
      errors.push(
        ...([
          validateBio(bio) && `Bio: ${validateBio(bio)}`,
        ].filter(Boolean) as string[])
      )

      payload = {
        ...payload,
        office_location: officeLocation || null,
        specialization: specialization || null,
        bio: bio || null,
      }
    }

    if (errors.length > 0) {
      setError(errors.join(', '))
      return
    }

    setSaving(true)
    const supabase = createClient()
    const table = role === 'instructor' ? 'instructor' : 'student'

    const { error: updateError } = await supabase
      .from(table)
      .update(payload)
      .eq('profile_id', userId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
    setEditing(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <ProfilePhotoUpload
              userId={userId}
              role={role}
              photoUrl={photoUrl}
              initials={initials}
              onUploaded={(url) => setPhotoUrl(url)}
            />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{fullName}</h2>
              <span className="mt-1 inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium capitalize text-primary">
                {role}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => (editing ? cancelEdit() : setEditing(true))}
            className={`flex items-center gap-2 self-start rounded-lg px-4 py-2 text-sm font-semibold transition sm:self-auto ${
              editing
                ? 'bg-accent/10 text-text-primary hover:bg-accent/20'
                : 'bg-cta text-cta-text hover:opacity-90'
            }`}
          >
            {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>
      </div>

      {/* Read-only info */}
      <ModuleCard title="Profile Information" icon={User} iconBgClassName="bg-accent/10">
        {role === 'student' && student ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <InfoField label="Registration No" value={student.student_roll} />
            <InfoField label="Program" value={student.program_name} />
            <InfoField label="Department" value={student.dept_name} />
            <InfoField label="Batch Year" value={String(student.batch_year)} />
            <InfoField label="Current Semester" value={String(student.current_semester)} />
            <InfoField label="CGPA" value={Number(student.cgpa).toFixed(2)} />
            <InfoField label="Total Credits" value={String(student.total_credits)} />
            <InfoField label="Joined" value={new Date(student.account_created_at).toLocaleDateString()} />
            <InfoField label="Status" value={student.is_active ? 'Active' : 'Inactive'} />
          </div>
        ) : instructor ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <InfoField label="Employee ID" value={instructor.employee_id} />
            <InfoField label="Designation" value={instructor.designation} />
            <InfoField label="Department" value={instructor.dept_name} />
            <InfoField label="Hire Date" value={new Date(instructor.hire_date).toLocaleDateString()} />
            <InfoField label="Status" value={instructor.is_active ? 'Active' : 'Inactive'} />
          </div>
        ) : null}
      </ModuleCard>

      {/* Editable form */}
      <ModuleCard title="Edit Details" icon={Pencil} iconBgClassName="bg-highlight/10" iconClassName="text-highlight">
        <form onSubmit={handleSave} className="space-y-4">
          <fieldset disabled={!editing} className="space-y-4 disabled:opacity-60">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>First Name</label>
                <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Last Name</label>
                <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Gender</label>
                <select className={inputClass} value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Date of Birth</label>
                <input
                  type="date"
                  className={inputClass}
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Phone</label>
              <input
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
              />
            </div>

            {role === 'student' ? (
              <>
                <div>
                  <label className={labelClass}>Address</label>
                  <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Emergency Contact Name</label>
                    <input
                      className={inputClass}
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Emergency Contact Phone</label>
                    <input
                      className={inputClass}
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={labelClass}>Office Location</label>
                  <input
                    className={inputClass}
                    value={officeLocation}
                    onChange={(e) => setOfficeLocation(e.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Specialization</label>
                  <input
                    className={inputClass}
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>Bio</label>
                  <textarea
                    className={inputClass}
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>
              </>
            )}
          </fieldset>

          {error && <p className="rounded-lg bg-notification/10 px-3 py-2 text-sm text-notification">{error}</p>}
          {success && <p className="rounded-lg bg-highlight/10 px-3 py-2 text-sm text-highlight">Profile updated successfully.</p>}

          {editing && (
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-cta px-4 py-2.5 text-sm font-semibold text-cta-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </form>
      </ModuleCard>
    </div>
  )
}
