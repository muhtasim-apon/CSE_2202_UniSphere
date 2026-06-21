'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, BookOpen, Building, Bus, CalendarDays, Loader2, Megaphone, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { type NoticePost, deleteNotice, getNotices } from '@/app/lib/noticeApi'
import { useNotifications } from '@/app/context/NotificationContext'
import NoticeCard from './components/NoticeCard'
import PostModal from './components/PostModal'

const CATEGORIES = [
  { key: '', label: 'All', Icon: Megaphone },
  { key: 'academics_exams', label: 'Academics & Exams', Icon: BookOpen },
  { key: 'general', label: 'General', Icon: Megaphone },
  { key: 'hall_info', label: 'Hall Info', Icon: Building },
  { key: 'transport', label: 'Transport', Icon: Bus },
  { key: 'emergency', label: 'Emergency', Icon: AlertTriangle },
  { key: 'upcoming_events', label: 'Upcoming Events', Icon: CalendarDays },
]

export default function NoticeBoard() {
  const { addNotification } = useNotifications()
  const [token, setToken] = useState('')
  const [userId, setUserId] = useState('')
  const [userRole, setUserRole] = useState('student')
  const [notices, setNotices] = useState<NoticePost[]>([])
  const [activeCategory, setActiveCategory] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingNotice, setEditingNotice] = useState<NoticePost | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Bootstrap: get session + role
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      setToken(session.access_token)
      setUserId(session.user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      setUserRole(profile?.role ?? 'student')
    })
  }, [])

  const fetchNotices = useCallback(async (cat: string, pg: number, append = false) => {
    if (!token) return
    if (pg === 1) setLoading(true)
    else setLoadingMore(true)
    setError('')
    try {
      const data = await getNotices(token, cat || undefined, pg)
      const fetched = data.notices ?? []
      setNotices(prev => (append ? [...prev, ...fetched] : fetched))
      setHasMore(fetched.length === 20)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load notices.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      setPage(1)
      fetchNotices(activeCategory, 1)
    }
  }, [token, activeCategory, fetchNotices, refreshKey])

  // Real-time: notify + refresh when another user posts
  useEffect(() => {
    if (!token || !userId) return
    const supabase = createClient()
    const channel = supabase
      .channel('notice-board-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notice_board_post' },
        (payload) => {
          const post = payload.new as { author_id: string; title: string; audience: string }
          if (post.author_id === userId) return
          // Respect audience rules: teachers skip student-only posts, students skip teacher-only posts
          if (post.audience === 'students' && userRole === 'teacher') return
          if (post.audience === 'teachers' && userRole !== 'teacher') return
          setRefreshKey(k => k + 1)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [token, userId, userRole])

  function handleCategoryChange(cat: string) {
    setActiveCategory(cat)
    setPage(1)
    setNotices([])
  }

  function handleLoadMore() {
    const nextPage = page + 1
    setPage(nextPage)
    fetchNotices(activeCategory, nextPage, true)
  }

  function handlePostSuccess(notice: NoticePost) {
    setModalOpen(false)
    setEditingNotice(null)
    if (editingNotice) {
      setNotices(prev => prev.map(n => (n.id === notice.id ? notice : n)))
      addNotification({
        type: 'notice',
        title: 'Post updated',
        body: notice.title,
        href: '/dashboard/notice-board',
      })
    } else {
      setNotices(prev => [notice, ...prev])
      addNotification({
        type: 'notice',
        title: 'Post published',
        body: notice.title,
        href: '/dashboard/notice-board',
      })
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this notice?')) return
    try {
      await deleteNotice(id, token)
      setNotices(prev => prev.filter(n => n.id !== id))
    } catch {}
  }

  function handleEdit(notice: NoticePost) {
    setEditingNotice(notice)
    setModalOpen(true)
  }

  function openNewPost() {
    setEditingNotice(null)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Notice Board</h1>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => handleCategoryChange(key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
              activeCategory === key
                ? 'bg-primary text-white'
                : 'bg-card border border-border text-text-muted hover:text-primary hover:border-primary'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-red-500">
          {error}
        </div>
      ) : notices.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Megaphone className="mx-auto mb-3 h-10 w-10 opacity-20" />
          <p className="font-medium text-text-primary">No notices yet</p>
          <p className="mt-1 text-sm text-text-muted">Be the first to post something!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notices.map(notice => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              currentUserId={userId}
              token={token}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 rounded-2xl border border-border bg-card px-6 py-2.5 text-sm font-medium text-text-muted transition hover:border-primary hover:text-primary disabled:cursor-wait"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Load more
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating Add Post button */}
      <button
        onClick={openNewPost}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 hover:shadow-xl active:scale-95"
      >
        <Plus className="h-4 w-4" />
        Add a Post
      </button>

      <PostModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingNotice(null) }}
        token={token}
        userRole={userRole}
        editData={editingNotice}
        onSuccess={handlePostSuccess}
      />
    </div>
  )
}
