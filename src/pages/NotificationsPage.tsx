import { Bell, CheckCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { EmptyState, ErrorMessage, LoadingState, PageHeader } from '../components/Ui'
import { formatDateTime } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Notification } from '../types'

export function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadNotifications() {
    const { data, error: queryError } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)
    if (queryError) setError(queryError.message)
    else setNotifications((data ?? []) as Notification[])
    setLoading(false)
  }

  useEffect(() => {
    queueMicrotask(() => void loadNotifications())
    if (!user) return
    const channel = supabase.channel(`notifications:${user.id}`).on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
      () => void loadNotifications(),
    ).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [user])

  async function markRead(notification: Notification) {
    if (notification.read_at) return
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notification.id)
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item))
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
    await loadNotifications()
  }

  return (
    <div className="page">
      <PageHeader title="Notifications" description="Invitations, term changes, approvals, and settlement updates." action={notifications.some((item) => !item.read_at) && <button className="button button--secondary" onClick={() => void markAllRead()}><CheckCheck size={17} /> Mark all read</button>} />
      {error && <ErrorMessage message={error} />}
      {loading ? <LoadingState /> : notifications.length === 0 ? <EmptyState title="No notifications" description="Updates from your teams will collect here." /> : (
        <section className="notification-list">
          {notifications.map((notification) => {
            const content = <><div className="notification-icon"><Bell size={18} /></div><div><h2>{notification.title}</h2><p>{notification.body}</p><time>{formatDateTime(notification.created_at)}</time></div>{!notification.read_at && <span className="unread-dot" />}</>
            return notification.href ? <Link to={notification.href} onClick={() => void markRead(notification)} className={`notification ${notification.read_at ? '' : 'notification--unread'}`} key={notification.id}>{content}</Link> : <button onClick={() => void markRead(notification)} className={`notification ${notification.read_at ? '' : 'notification--unread'}`} key={notification.id}>{content}</button>
          })}
        </section>
      )}
    </div>
  )
}