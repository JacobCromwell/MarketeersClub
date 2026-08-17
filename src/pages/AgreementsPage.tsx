import { Check, Handshake, MessageSquareText, PackageCheck, Pencil, Plus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { EmptyState, ErrorMessage, LoadingState, Modal, PageHeader } from '../components/Ui'
import { calculateSettlement } from '../domain/agreements'
import { dollarsToCents, formatDateTime, formatMoney } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Agreement, InventoryItem, Trip } from '../types'

interface TermsForm {
  tripId: string
  itemId: string
  quantity: string
  unitPrice: string
  commission: string
  message: string
}

const emptyTerms: TermsForm = { tripId: '', itemId: '', quantity: '1', unitPrice: '0.00', commission: '0.00', message: '' }

export function AgreementsPage() {
  const { user } = useAuth()
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [changeAgreement, setChangeAgreement] = useState<Agreement | null>(null)
  const [reportAgreement, setReportAgreement] = useState<Agreement | null>(null)
  const [terms, setTerms] = useState<TermsForm>(emptyTerms)
  const [soldQuantity, setSoldQuantity] = useState('0')
  const [saving, setSaving] = useState(false)

  async function loadData() {
    const [agreementResult, itemResult, tripResult] = await Promise.all([
      supabase.from('agreements').select('*, inventory_items(id, name, quantity), trips(id, title, event_at), owner:profiles!agreements_owner_id_fkey(id, display_name), seller:profiles!agreements_seller_id_fkey(id, display_name)').order('updated_at', { ascending: false }),
      supabase.from('inventory_items').select('*').gt('quantity', 0).order('name'),
      supabase.from('trips').select('*').gte('return_at', new Date().toISOString()).neq('status', 'cancelled').order('event_at'),
    ])
    const queryError = agreementResult.error || itemResult.error || tripResult.error
    if (queryError) setError(queryError.message)
    else {
      setAgreements((agreementResult.data ?? []) as unknown as Agreement[])
      setItems((itemResult.data ?? []) as InventoryItem[])
      setTrips((tripResult.data ?? []) as Trip[])
    }
    setLoading(false)
  }

  useEffect(() => { queueMicrotask(() => void loadData()) }, [])

  function openCreate() {
    const firstItem = items[0]
    setTerms({
      ...emptyTerms,
      tripId: trips.find((trip) => trip.seller_id !== user?.id)?.id ?? '',
      itemId: firstItem?.id ?? '',
      unitPrice: firstItem ? (firstItem.default_price_cents / 100).toFixed(2) : '0.00',
    })
    setCreateOpen(true)
  }

  function chooseItem(itemId: string) {
    const item = items.find((candidate) => candidate.id === itemId)
    setTerms({ ...terms, itemId, unitPrice: item ? (item.default_price_cents / 100).toFixed(2) : terms.unitPrice })
  }

  async function createAgreement(event: FormEvent) {
    event.preventDefault()
    if (!user) return
    const trip = trips.find((candidate) => candidate.id === terms.tripId)
    if (!trip) return setError('Choose an available team trip.')
    setSaving(true)
    const unitPriceCents = dollarsToCents(terms.unitPrice)
    const commissionCents = dollarsToCents(terms.commission)
    try {
      calculateSettlement(Number.parseInt(terms.quantity, 10), 0, unitPriceCents, commissionCents)
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Check the agreement terms.')
      setSaving(false)
      return
    }
    const { data, error: insertError } = await supabase.from('agreements').insert({
      trip_id: trip.id,
      item_id: terms.itemId,
      owner_id: user.id,
      seller_id: trip.seller_id,
      quantity: Number.parseInt(terms.quantity, 10),
      unit_price_cents: unitPriceCents,
      commission_per_item_cents: commissionCents,
    }).select('id').single()
    if (insertError) setError(insertError.message)
    else {
      if (terms.message.trim()) await supabase.from('agreement_messages').insert({ agreement_id: data.id, author_id: user.id, body: terms.message.trim() })
      setCreateOpen(false)
      await loadData()
    }
    setSaving(false)
  }

  async function approve(agreement: Agreement) {
    const { error: actionError } = await supabase.rpc('approve_agreement', { p_agreement_id: agreement.id })
    if (actionError) setError(actionError.message)
    else await loadData()
  }

  function openChange(agreement: Agreement) {
    setChangeAgreement(agreement)
    setTerms({
      tripId: agreement.trip_id,
      itemId: agreement.item_id,
      quantity: String(agreement.quantity),
      unitPrice: (agreement.unit_price_cents / 100).toFixed(2),
      commission: (agreement.commission_per_item_cents / 100).toFixed(2),
      message: '',
    })
  }

  async function requestChange(event: FormEvent) {
    event.preventDefault()
    if (!changeAgreement) return
    setSaving(true)
    const { error: actionError } = await supabase.rpc('request_agreement_change', {
      p_agreement_id: changeAgreement.id,
      p_quantity: Number.parseInt(terms.quantity, 10),
      p_unit_price_cents: dollarsToCents(terms.unitPrice),
      p_commission_cents: dollarsToCents(terms.commission),
      p_message: terms.message.trim(),
    })
    if (actionError) setError(actionError.message)
    else { setChangeAgreement(null); await loadData() }
    setSaving(false)
  }

  async function reportSales(event: FormEvent) {
    event.preventDefault()
    if (!reportAgreement) return
    setSaving(true)
    const { error: actionError } = await supabase.rpc('report_agreement_sales', {
      p_agreement_id: reportAgreement.id,
      p_sold_quantity: Number.parseInt(soldQuantity, 10),
    })
    if (actionError) setError(actionError.message)
    else { setReportAgreement(null); await loadData() }
    setSaving(false)
  }

  async function settle(agreement: Agreement) {
    if (!window.confirm('Confirm that you received the payout and all unsold merchandise? This updates your inventory.')) return
    const { error: actionError } = await supabase.rpc('settle_agreement', { p_agreement_id: agreement.id })
    if (actionError) setError(actionError.message)
    else await loadData()
  }

  const availableTrips = trips.filter((trip) => trip.seller_id !== user?.id)

  return (
    <div className="page">
      <PageHeader title="Sale agreements" description="Every term change requires fresh approval before merchandise changes hands." action={<button className="button button--primary" onClick={openCreate} disabled={items.length === 0 || availableTrips.length === 0}><Plus size={18} /> Propose agreement</button>} />
      {error && <ErrorMessage message={error} />}
      {!loading && (items.length === 0 || availableTrips.length === 0) && <div className="alert"><Handshake size={18} /> To propose an agreement, add inventory and join a trip hosted by a teammate.</div>}
      {loading ? <LoadingState /> : agreements.length === 0 ? (
        <EmptyState title="No agreements yet" description="Propose merchandise for a teammate’s trip, then agree on quantity, price, and commission." action={items.length > 0 && availableTrips.length > 0 && <button className="button button--secondary" onClick={openCreate}>Make a proposal</button>} />
      ) : (
        <section className="agreement-list">
          {agreements.map((agreement) => {
            const isOwner = agreement.owner_id === user?.id
            const myApproved = (isOwner ? agreement.owner_approved_version : agreement.seller_approved_version) === agreement.terms_version
            const otherApproved = (isOwner ? agreement.seller_approved_version : agreement.owner_approved_version) === agreement.terms_version
            const settlement = agreement.sold_quantity === null ? null : calculateSettlement(agreement.quantity, agreement.sold_quantity, agreement.unit_price_cents, agreement.commission_per_item_cents)
            return (
              <article className="agreement-card" key={agreement.id}>
                <header>
                  <div><p className="eyebrow">{agreement.trips?.title || 'Team trip'} · Terms v{agreement.terms_version}</p><h2>{agreement.inventory_items?.name || 'Inventory item'}</h2><p>{isOwner ? `Selling with ${agreement.seller?.display_name || 'teammate'}` : `For ${agreement.owner?.display_name || 'teammate'}`}</p></div>
                  <span className={`status status--${agreement.status}`}>{agreement.status.replace('_', ' ')}</span>
                </header>
                <div className="terms-grid">
                  <div><span>Quantity</span><strong>{agreement.quantity}</strong></div>
                  <div><span>Unit price</span><strong>{formatMoney(agreement.unit_price_cents)}</strong></div>
                  <div><span>Seller commission</span><strong>{formatMoney(agreement.commission_per_item_cents)} / sold</strong></div>
                  <div><span>Event</span><strong>{agreement.trips ? formatDateTime(agreement.trips.event_at) : '—'}</strong></div>
                </div>

                {(agreement.status === 'proposed' || agreement.status === 'changes_requested') && (
                  <div className="approval-row">
                    <div><span className={myApproved ? 'approval approval--done' : 'approval'}>{myApproved && <Check size={14} />} You</span><span className={otherApproved ? 'approval approval--done' : 'approval'}>{otherApproved && <Check size={14} />} {isOwner ? 'Seller' : 'Owner'}</span></div>
                    <div>{!myApproved && <button className="button button--primary" onClick={() => void approve(agreement)}><Check size={17} /> Approve terms</button>}<button className="button button--ghost" onClick={() => openChange(agreement)}><Pencil size={16} /> Request change</button></div>
                  </div>
                )}

                {agreement.status === 'approved' && (
                  <div className="agreement-action"><div><Check size={18} /><span><strong>Approved by both members</strong><small>Ready for the merchandise handoff.</small></span></div>{!isOwner && <button className="button button--secondary" onClick={() => { setReportAgreement(agreement); setSoldQuantity('0') }}><PackageCheck size={17} /> Report sales</button>}</div>
                )}

                {agreement.status === 'reported' && settlement && (
                  <div className="settlement">
                    <div><p className="eyebrow">Seller report</p><h3>{agreement.sold_quantity} sold · {settlement.unsoldQuantity} returning</h3></div>
                    <div><span>Gross sales <strong>{formatMoney(settlement.grossCents)}</strong></span><span>Commission <strong>− {formatMoney(settlement.commissionCents)}</strong></span><span>Owner payout <strong>{formatMoney(settlement.ownerPayoutCents)}</strong></span></div>
                    {isOwner ? <button className="button button--primary" onClick={() => void settle(agreement)}><PackageCheck size={17} /> Confirm receipt & settle</button> : <p>Waiting for the owner to confirm receipt.</p>}
                  </div>
                )}
              </article>
            )
          })}
        </section>
      )}

      {createOpen && (
        <Modal title="Propose a sale agreement" onClose={() => setCreateOpen(false)}>
          <form className="form-grid" onSubmit={(event) => void createAgreement(event)}>
            <label className="field--wide">Team trip<select value={terms.tripId} onChange={(event) => setTerms({ ...terms, tripId: event.target.value })} required><option value="">Select a trip</option>{availableTrips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title} · {formatDateTime(trip.event_at)}</option>)}</select></label>
            <label className="field--wide">Your item<select value={terms.itemId} onChange={(event) => chooseItem(event.target.value)} required><option value="">Select inventory</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.quantity} on hand)</option>)}</select></label>
            <TermsFields terms={terms} setTerms={setTerms} />
            <label className="field--wide">Note to seller (optional)<textarea value={terms.message} onChange={(event) => setTerms({ ...terms, message: event.target.value })} rows={3} maxLength={1000} /></label>
            <div className="form-actions field--wide"><button type="button" className="button button--ghost" onClick={() => setCreateOpen(false)}>Cancel</button><button className="button button--primary" disabled={saving}>{saving ? 'Sending…' : 'Send proposal'}</button></div>
          </form>
        </Modal>
      )}

      {changeAgreement && (
        <Modal title="Request new terms" onClose={() => setChangeAgreement(null)}>
          <form className="form-grid" onSubmit={(event) => void requestChange(event)}>
            <TermsFields terms={terms} setTerms={setTerms} />
            <label className="field--wide">What changed?<textarea value={terms.message} onChange={(event) => setTerms({ ...terms, message: event.target.value })} rows={3} required maxLength={1000} /></label>
            <div className="alert field--wide"><MessageSquareText size={18} /> Changing any term creates version {changeAgreement.terms_version + 1} and requires the other member’s approval.</div>
            <div className="form-actions field--wide"><button type="button" className="button button--ghost" onClick={() => setChangeAgreement(null)}>Cancel</button><button className="button button--primary" disabled={saving}>{saving ? 'Sending…' : 'Request change'}</button></div>
          </form>
        </Modal>
      )}

      {reportAgreement && (
        <Modal title="Report trip sales" onClose={() => setReportAgreement(null)}>
          <form onSubmit={(event) => void reportSales(event)}><p>Enter how many of the {reportAgreement.quantity} agreed items sold.</p><label>Quantity sold<input type="number" value={soldQuantity} onChange={(event) => setSoldQuantity(event.target.value)} min="0" max={reportAgreement.quantity} step="1" required autoFocus /></label><div className="form-actions"><button type="button" className="button button--ghost" onClick={() => setReportAgreement(null)}>Cancel</button><button className="button button--primary" disabled={saving}>Submit report</button></div></form>
        </Modal>
      )}
    </div>
  )
}

function TermsFields({ terms, setTerms }: { terms: TermsForm; setTerms: (terms: TermsForm) => void }) {
  return (
    <>
      <label>Quantity<input type="number" value={terms.quantity} onChange={(event) => setTerms({ ...terms, quantity: event.target.value })} required min="1" step="1" /></label>
      <label>Unit sale price<input type="number" value={terms.unitPrice} onChange={(event) => setTerms({ ...terms, unitPrice: event.target.value })} required min="0" step="0.01" /></label>
      <label>Commission per item sold<input type="number" value={terms.commission} onChange={(event) => setTerms({ ...terms, commission: event.target.value })} required min="0" step="0.01" /></label>
    </>
  )
}