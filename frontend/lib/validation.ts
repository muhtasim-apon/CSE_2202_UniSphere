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

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters'
  return null
}
