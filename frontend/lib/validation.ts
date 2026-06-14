export function validateName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length < 2 || trimmed.length > 60) return 'Must be 2-60 characters'
  if (trimmed !== name) return 'No leading or trailing spaces'
  if (/ {2,}/.test(name)) return 'No double spaces'
  if (!/^[A-Za-z ]+$/.test(name)) return 'Letters and spaces only'
  return null
}

export function validateEmail(email: string): string | null {
  if (email.length < 6 || email.length > 150) return 'Must be 6-150 characters'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format'
  return null
}

export function validatePhone(phone: string): string | null {
  if (!phone) return null
  if (!/^01[3-9][0-9]{8}$/.test(phone)) return 'Phone must be in the format 01XXXXXXXXX'
  return null
}

export function toLocalPhone(phone: string | null): string {
  if (!phone) return ''
  if (/^\+8801[3-9][0-9]{8}$/.test(phone)) return '0' + phone.slice(4)
  return phone
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters'
  return null
}

export function validateAddress(address: string): string | null {
  if (!address) return null
  const trimmed = address.trim()
  if (trimmed.length < 5 || trimmed.length > 300) return 'Must be 5-300 characters'
  return null
}

export function validateBio(bio: string): string | null {
  if (!bio) return null
  const trimmed = bio.trim()
  if (trimmed.length < 10 || trimmed.length > 2000) return 'Must be 10-2000 characters'
  return null
}

export function validateDeptName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length < 2 || trimmed.length > 100) return 'Must be 2-100 characters'
  return null
}

export function validateDeptCode(code: string): string | null {
  if (!/^[A-Z]{2,10}$/.test(code)) return 'Must be 2-10 uppercase letters (e.g. CSE)'
  return null
}

export function validateProgramName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length < 3 || trimmed.length > 150) return 'Must be 3-150 characters'
  return null
}

export function validateProgramCode(code: string): string | null {
  if (!/^[A-Z0-9-]{2,20}$/.test(code)) return 'Must be 2-20 uppercase letters, digits or hyphens (e.g. CSE-BSC)'
  return null
}

export function validateRegistrationNo(regNo: string): string | null {
  if (!/^[0-9]{4,20}$/.test(regNo)) return 'Must be 4-20 digits'
  return null
}

export function validateEmployeeId(id: string): string | null {
  if (!/^EMP-[0-9]{3,6}$/.test(id)) return 'Format must be EMP-NNN (e.g. EMP-001)'
  return null
}

export function validateBatchYear(year: string): string | null {
  const n = Number(year)
  const maxYear = new Date().getFullYear() + 1
  if (!Number.isInteger(n) || n < 2000 || n > maxYear) return `Must be between 2000 and ${maxYear}`
  return null
}

export function validateDateOfBirth(dob: string, minAge: number, maxAge = 80): string | null {
  if (!dob) return 'Required'
  const date = new Date(dob)
  if (Number.isNaN(date.getTime())) return 'Invalid date'

  const today = new Date()
  const minDate = new Date(today.getFullYear() - maxAge, today.getMonth(), today.getDate())
  const maxDate = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate())

  if (date < minDate || date > maxDate) return `Age must be between ${minAge} and ${maxAge} years`
  return null
}
