import { ArrowRight, Boxes, CalendarDays, CircleDollarSign, Handshake } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { EmptyState, ErrorMessage, LoadingState, PageHeader } from '../components/Ui'
import { formatDateTime } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Agreement, Trip } from '../types'

interface DashboardData {
  inventoryCount: number
  agreementCount: number
  unreadCount: number
  trips: Trip[]
  actionAgreements: Agreement[]
}

export function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadDashboard() {
      const [inventory, agreements, notifications, trips, actions] = await Promise.all([
        supabase.from('inventory_items').select('*', { count: 'exact', head: true }),
        supabase.from('agreements').select('*', { count: 'exact', head: true }),
        supabase.from('notifications').select('*', { count: 'exact', head: true }).is('read_at', null),
        supabase.from('trips').select('*').gte('event_at', new Date().toISOString()).neq('status', 'cancelled').order('event_at').limit(4),
        supabase.from('agreements').select('*').in('status', ['proposed', 'changes_requested', 'reported']).order('updated_at', { ascending: false }).limit(4),
      ])

      const firstError = [inventory, agreements, notifications, trips, actions].find((result) => result.error)?.error
      if (firstError) {
        setError(firstError.message)
        return
      }

      setData({
        inventoryCount: inventory.count ?? 0,
        agreementCount: agreements.count ?? 0,
        unreadCount: notifications.count ?? 0,
        trips: (trips.data ?? []) as Trip[],
        actionAgreements: (actions.data ?? []) as Agreement[],
      })
    }

    void loadDashboard()
  }, [])

  if (error) return <div className="page"><ErrorMessage message={error} /></div>
  if (!data) return <div className="page"><LoadingState /></div>

  const firstName = (user?.user_metadata.display_name as string | undefined)?.split(' ')[0] || 'there'

  return (
    <div className="page">
      <PageHeader title={`Good to see you, ${firstName}.`} description="Here’s what is moving across your teams." />

      <section className="metric-grid" aria-label="Workspace summary">
        <Link to="/inventory" className="metric metric--green"><Boxes /><span>Item types</span><strong>{data.inventoryCount}</strong></Link>
        <Link to="/trips" className="metric metric--coral"><CalendarDays /><span>Upcoming trips</span><strong>{data.trips.length}</strong></Link>
        <Link to="/agreements" className="metric metric--gold"><Handshake /><span>Agreements</span><strong>{data.agreementCount}</strong></Link>
        <Link to="/notifications" className="metric metric--ink"><CircleDollarSign /><span>Unread updates</span><strong>{data.unreadCount}</strong></Link>
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <header className="panel__header"><div><p className="eyebrow">On the calendar</p><h2>Upcoming trips</h2></div><Link to="/trips">View all <ArrowRight size={16} /></Link></header>
          {data.trips.length === 0 ? (
            <EmptyState title="No trips yet" description="Create a trip and give your team time to prepare." action={<Link className="button button--secondary" to="/trips">Create trip</Link>} />
          ) : (
            <div className="list">
              {data.trips.map((trip) => (
                <article className="list-row" key={trip.id}>
                  <div className="date-tile"><strong>{new Date(trip.event_at).getDate()}</strong><span>{new Date(trip.event_at).toLocaleString('en-US', { month: 'short' })}</span></div>
                  <div><h3>{trip.title}</h3><p>{formatDateTime(trip.event_at)}</p></div>
                  <span className="status status--upcoming">Upcoming</span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <header className="panel__header"><div><p className="eyebrow">Needs attention</p><h2>Open handoffs</h2></div><Link to="/agreements">View all <ArrowRight size={16} /></Link></header>
          {data.actionAgreements.length === 0 ? (
            <EmptyState title="All caught up" description="New proposals and settlements will appear here." />
          ) : (
            <div className="list">
              {data.actionAgreements.map((agreement) => (
                <article className="list-row list-row--compact" key={agreement.id}>
                  <div className="agreement-mark"><Handshake size={18} /></div>
                  <div><h3>Agreement #{agreement.id.slice(0, 6)}</h3><p>{agreement.quantity} items · terms v{agreement.terms_version}</p></div>
                  <span className={`status status--${agreement.status}`}>{agreement.status.replace('_', ' ')}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}