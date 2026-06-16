const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? ''

/**
 * Client-side API base. Empty string = same-origin `/api/...` (proxied to FastAPI by Next.js).
 * Set NEXT_PUBLIC_API_URL only for production (e.g. deployed backend URL).
 */
export const API_BASE = configured

/** Server Components / SSR — call FastAPI directly when no public URL is configured. */
export function serverApiBase(): string {
  return configured || process.env.INTERNAL_API_URL || 'http://127.0.0.1:8000'
}
