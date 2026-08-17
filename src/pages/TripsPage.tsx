import { CalendarPlus, Clock3, MapPin, Plus, Route } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { EmptyState, ErrorMessage, LoadingState, Modal, PageHeader } from '../components/Ui'
import { formatDateTime } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Team, Trip } from '../types'

const emptyForm = {
  teamId: '', title: '', eventAt: '', pickupAt: '', pickupLocation: '', returnAt: '', returnLocation: '', note: '',
}

export function TripsPage() {
  const { user } = useAuth()
  const [trips, setTrips] = useState<Trip[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function loadData() {
    const [tripResult, teamResult] = await Promise.all([
      supabase.from('trips').select('*, teams(id, name), profiles!trips_seller_id_fkey(id, display_name)').order('event_at'),
      supabase.from('teams').select('*').order('name'),
    ])
    if (tripResult.error || teamResult.error) setError(tripResult.error?.message || teamResult.error?.message || 'Could not load trips.')
    else {
      setTrips((tripResult.data ?? []) as unknown as Trip[])
      setTeams((teamResult.data ?? []) as Team[])
    }
    setLoading(false)
  }

  useEffect(() => { queueMicrotask(() => void loadData()) }, [])

  function openCreate() {
    setForm({ ...emptyForm, teamId: teams[0]?.id ?? '' })
    setModalOpen(true)
  }

  async function saveTrip(event: FormEvent) {
    event.preventDefault()
    if (!user) return
    setSaving(true)
    const { error: insertError } = await supabase.from('trips').insert({
      team_id: form.teamId,
      seller_id: user.id,
      title: form.title.trim(),
      event_at: new Date(form.eventAt).toISOString(),
      pickup_at: new Date(form.pickupAt).toISOString(),
      pickup_location: form.pickupLocation.trim(),
      return_at: new Date(form.returnAt).toISOString(),
      return_location: (form.returnLocation || form.pickupLocation).trim(),
      note: form.note.trim() || null,
    })
    if (insertError) setError(insertError.message)
    else { setModalOpen(false); await loadData() }
    setSaving(false)
  }

  const upcoming = trips.filter((trip) => trip.status !== 'cancelled' && new Date(trip.return_at) >= new Date())
  const past = trips.filter((trip) => trip.status === 'cancelled' || new Date(trip.return_at) < new Date())

  return (
    <div className="page">
      <PageHeader title="Team trips" description="Publish the exact pickup and return plan before accepting merchandise." action={<button className="button button--primary" onClick={openCreate} disabled={teams.length === 0}><Plus size={18} /> New trip</button>} />
      {error && <ErrorMessage message={error} />}
      {teams.length === 0 && !loading && <div className="alert"><Route size={18} /> Join or create a team before posting a trip.</div>}
      {loading ? <LoadingState /> : upcoming.length === 0 ? (
        <EmptyState title="No upcoming trips" description="Give your team a destination and enough time to propose merchandise." action={teams.length > 0 && <button className="button button--secondary" onClick={openCreate}>Plan a trip</button>} />
      ) : (
        <section className="trip-list">
          {upcoming.map((trip) => (
            <article className="trip-card" key={trip.id}>
              <div className="trip-card__date"><span>{new Date(trip.event_at).toLocaleString('en-US', { month: 'short' })}</span><strong>{new Date(trip.event_at).getDate()}</strong><small>{new Date(trip.event_at).getFullYear()}</small></div>
              <div className="trip-card__body">
                <div className="trip-card__title"><div><p className="eyebrow">{trip.teams?.name || 'Team trip'}</p><h2>{trip.title}</h2><p>Hosted by {trip.profiles?.display_name || 'a teammate'}</p></div><span className="status status--upcoming">{trip.status.replace('_', ' ')}</span></div>
                <div className="handoff-grid">
                  <div><CalendarPlus size={18} /><span>Event</span><strong>{formatDateTime(trip.event_at)}</strong></div>
                  <div><Clock3 size={18} /><span>Pre-trip pickup</span><strong>{formatDateTime(trip.pickup_at)}</strong><small><MapPin size={14} />{trip.pickup_location}</small></div>
                  <div><Clock3 size={18} /><span>Return handoff</span><strong>{formatDateTime(trip.return_at)}</strong><small><MapPin size={14} />{trip.return_location}</small></div>
                </div>
                {trip.note && <p className="trip-note">“{trip.note}”</p>}
              </div>
            </article>
          ))}
        </section>
      )}

      {past.length > 0 && <section className="past-section"><h2>Past trips</h2><div className="list">{past.slice(0, 5).map((trip) => <div className="list-row" key={trip.id}><div><h3>{trip.title}</h3><p>{formatDateTime(trip.event_at)}</p></div><span className="status">{trip.status}</span></div>)}</div></section>}

      {modalOpen && (
        <Modal title="Plan a team trip" onClose={() => setModalOpen(false)}>
          <form className="form-grid" onSubmit={(event) => void saveTrip(event)}>
            <label className="field--wide">Team<select value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value })} required><option value="">Select a team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            <label className="field--wide">Trip title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required maxLength={120} placeholder="Going to Tradeshow in DC" /></label>
            <label className="field--wide">Event date and time<input type="datetime-local" value={form.eventAt} onChange={(event) => setForm({ ...form, eventAt: event.target.value })} required /></label>
            <label>Pickup date and time<input type="datetime-local" value={form.pickupAt} onChange={(event) => setForm({ ...form, pickupAt: event.target.value })} required /></label>
            <label>Pickup location<input value={form.pickupLocation} onChange={(event) => setForm({ ...form, pickupLocation: event.target.value })} required maxLength={300} /></label>
            <label>Return date and time<input type="datetime-local" value={form.returnAt} onChange={(event) => setForm({ ...form, returnAt: event.target.value })} required /></label>
            <label>Return location<input value={form.returnLocation} onChange={(event) => setForm({ ...form, returnLocation: event.target.value })} maxLength={300} placeholder="Same as pickup if blank" /></label>
            <label className="field--wide">Note (optional)<textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} rows={3} maxLength={1000} /></label>
            <div className="form-actions field--wide"><button type="button" className="button button--ghost" onClick={() => setModalOpen(false)}>Cancel</button><button className="button button--primary" disabled={saving}>{saving ? 'Publishing…' : 'Publish trip'}</button></div>
          </form>
        </Modal>
      )}
    </div>
  )
}