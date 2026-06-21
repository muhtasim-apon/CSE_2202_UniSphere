'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, Copy, Check, Search } from 'lucide-react'
import { createGroupRoom, getPeople, type ChatRoom, type PersonEntry } from '@/app/lib/chatApi'

type Props = {
  token: string
  onCreated: (room: ChatRoom) => void
  onClose: () => void
}

type RoleFilter = 'student' | 'teacher'

export default function NewGroupModal({ token, onCreated, onClose }: Props) {
  const [title, setTitle]           = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [emails, setEmails]         = useState<string[]>([])
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [created, setCreated]       = useState<{ room: ChatRoom; roomCode: string; notFound: string[] } | null>(null)
  const [copied, setCopied]         = useState(false)

  // People picker
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('student')
  const [people, setPeople]         = useState<PersonEntry[]>([])
  const [peopleSearch, setPeopleSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch people whenever role or search changes
  useEffect(() => {
    if (!showDropdown) return
    getPeople(token, peopleSearch || undefined)
      .then(list => setPeople(list.filter(p => {
        const r = p.role?.toLowerCase() ?? ''
        if (roleFilter === 'teacher') return r === 'faculty' || r === 'teacher'
        return r === 'student'
      })))
      .catch(() => {})
  }, [token, roleFilter, peopleSearch, showDropdown])

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function addEmail(email: string) {
    const e = email.trim().toLowerCase()
    if (e && !emails.includes(e)) setEmails(prev => [...prev, e])
  }

  function addManualEmail() {
    addEmail(emailInput)
    setEmailInput('')
  }

  // Selected people (by PersonEntry, to show name+avatar)
  const [selectedPeople, setSelectedPeople] = useState<PersonEntry[]>([])

  function togglePerson(person: PersonEntry) {
    setSelectedPeople(prev =>
      prev.some(p => p.id === person.id)
        ? prev.filter(p => p.id !== person.id)
        : [...prev, person]
    )
  }

  async function handleCreate() {
    if (!title.trim()) { setError('Title is required'); return }
    setLoading(true); setError('')
    try {
      // Combine manual emails + selected people emails
      // PersonEntry doesn't have email exposed — we pass profile IDs separately
      // For now we merge: manual emails go as member_emails
      const result = await createGroupRoom(
        {
          title: title.trim(),
          member_emails: emails,
          member_ids: selectedPeople.map(p => p.id),
          password: password || undefined,
        },
        token
      )
      setCreated({ room: result, roomCode: result.room_code, notFound: result.not_found_emails ?? [] })
    } catch (e: any) {
      setError(e.message ?? 'Failed to create room')
    } finally { setLoading(false) }
  }

  function handleCopy() {
    navigator.clipboard.writeText(created!.roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDone() {
    if (created) onCreated(created.room)
  }

  const filteredPeople = people.filter(p =>
    !selectedPeople.some(s => s.id === p.id)
  )

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={created ? undefined : onClose}
      >
        <motion.div
          className="bg-card border border-border rounded-card p-6 w-full max-w-md shadow-[var(--shadow-card)] max-h-[90vh] overflow-y-auto"
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-primary font-semibold text-base">
              {created ? 'Group Created!' : 'New Group Room'}
            </h2>
            <button onClick={created ? handleDone : onClose} className="text-muted hover:text-primary transition-colors">
              <X size={18} />
            </button>
          </div>

          {created ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted">
                Share this code so others can join <span className="font-semibold text-primary">{created.room.title}</span>:
              </p>
              <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-4 py-3">
                <span className="flex-1 text-lg font-mono font-bold text-accent tracking-widest">
                  {created.roomCode}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg hover:bg-secondary/40 transition-colors text-muted hover:text-primary"
                  title="Copy code"
                >
                  {copied ? <Check size={16} className="text-highlight" /> : <Copy size={16} />}
                </button>
              </div>
              {created.notFound.length > 0 && (
                <p className="text-xs text-amber-500">
                  Could not find accounts for: {created.notFound.join(', ')}
                </p>
              )}
              <button
                onClick={handleDone}
                className="w-full bg-cta text-cta-text rounded-lg py-2 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Open Group Chat
              </button>
            </div>
          ) : (
            <>
              <label className="block text-xs font-medium text-muted mb-1">Room title</label>
              <input
                className="w-full bg-background border border-border text-primary rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-accent transition-colors"
                value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Study Group"
              />

              {/* ── People picker ── */}
              <label className="block text-xs font-medium text-muted mb-2">Add members</label>

              {/* Role toggle */}
              <div className="flex bg-background border border-border rounded-lg p-0.5 mb-3 w-fit">
                {(['student', 'teacher'] as RoleFilter[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                      roleFilter === r ? 'bg-accent text-card' : 'text-muted hover:text-primary'
                    }`}
                  >
                    {r === 'teacher' ? 'Teacher' : 'Student'}
                  </button>
                ))}
              </div>

              {/* Search + dropdown */}
              <div className="relative mb-3" ref={dropdownRef}>
                <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
                  <Search size={13} className="text-muted flex-shrink-0" />
                  <input
                    className="flex-1 text-sm text-primary bg-transparent outline-none placeholder:text-muted"
                    placeholder={`Search ${roleFilter}s…`}
                    value={peopleSearch}
                    onChange={e => setPeopleSearch(e.target.value)}
                    onFocus={() => setShowDropdown(true)}
                  />
                </div>
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                    {filteredPeople.length === 0 ? (
                      <p className="text-xs text-muted px-3 py-3 text-center">No {roleFilter}s found</p>
                    ) : filteredPeople.map(person => (
                      <div key={person.id} className="flex items-center gap-2 px-3 py-2 hover:bg-secondary/30 transition-colors">
                        <div className="w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
                          {person.avatar_url
                            ? <img src={person.avatar_url} alt="" className="w-full h-full object-cover" />
                            : (person.display_name?.[0]?.toUpperCase() ?? '?')}
                        </div>
                        <span className="flex-1 text-sm text-primary truncate">{person.display_name ?? 'Unknown'}</span>
                        <button
                          onClick={() => { togglePerson(person); setShowDropdown(false); setPeopleSearch('') }}
                          className="p-1 rounded-lg bg-cta text-cta-text hover:opacity-80 transition-opacity"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manual email entry */}
              <div className="flex gap-2 mb-2">
                <input
                  type="email"
                  className="flex-1 bg-background border border-border text-primary rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                  value={emailInput} onChange={e => setEmailInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addManualEmail())}
                  placeholder="Or type email manually…"
                />
                <button onClick={addManualEmail} className="px-3 py-2 bg-cta text-cta-text rounded-lg text-sm hover:opacity-90 transition-opacity">
                  <Plus size={15} />
                </button>
              </div>

              {/* Selected people */}
              {selectedPeople.map(person => (
                <div key={person.id} className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5 mb-1">
                  <div className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px] font-bold flex-shrink-0 overflow-hidden">
                    {person.avatar_url
                      ? <img src={person.avatar_url} alt="" className="w-full h-full object-cover" />
                      : (person.display_name?.[0]?.toUpperCase() ?? '?')}
                  </div>
                  <span className="flex-1 text-xs text-primary truncate">{person.display_name}</span>
                  <button onClick={() => setSelectedPeople(prev => prev.filter(p => p.id !== person.id))} className="text-muted hover:text-red-500">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}

              {/* Manual emails */}
              {emails.map(email => (
                <div key={email} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-1.5 mb-1 text-xs text-primary">
                  <span className="truncate">{email}</span>
                  <button onClick={() => setEmails(prev => prev.filter(e => e !== email))} className="ml-2 text-muted hover:text-red-500">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}

              <label className="block text-xs font-medium text-muted mt-4 mb-1">Password (optional)</label>
              <input
                type="password"
                className="w-full bg-background border border-border text-primary rounded-lg px-3 py-2 text-sm mb-5 outline-none focus:border-accent transition-colors"
                value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank for no password"
              />

              {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

              <button
                onClick={handleCreate}
                disabled={loading}
                className="w-full bg-cta text-cta-text rounded-lg py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Creating…' : 'Create Room'}
              </button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
