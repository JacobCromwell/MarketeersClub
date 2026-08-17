import { Boxes, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { EmptyState, ErrorMessage, LoadingState, Modal, PageHeader } from '../components/Ui'
import { dollarsToCents, formatMoney } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { InventoryItem } from '../types'

const emptyForm = { name: '', sku: '', description: '', quantity: '1', defaultPrice: '0.00' }

export function InventoryPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function loadItems() {
    const { data, error: queryError } = await supabase.from('inventory_items').select('*').order('name')
    if (queryError) setError(queryError.message)
    else setItems((data ?? []) as InventoryItem[])
    setLoading(false)
  }

  useEffect(() => { queueMicrotask(() => void loadItems()) }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(item: InventoryItem) {
    setEditing(item)
    setForm({
      name: item.name,
      sku: item.sku ?? '',
      description: item.description ?? '',
      quantity: String(item.quantity),
      defaultPrice: (item.default_price_cents / 100).toFixed(2),
    })
    setModalOpen(true)
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault()
    if (!user) return
    setSaving(true)
    setError('')
    const values = {
      owner_id: user.id,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      description: form.description.trim() || null,
      quantity: Number.parseInt(form.quantity, 10),
      default_price_cents: dollarsToCents(form.defaultPrice),
    }
    const result = editing
      ? await supabase.from('inventory_items').update(values).eq('id', editing.id)
      : await supabase.from('inventory_items').insert(values)

    if (result.error) setError(result.error.message)
    else {
      setModalOpen(false)
      await loadItems()
    }
    setSaving(false)
  }

  async function deleteItem(item: InventoryItem) {
    if (!window.confirm(`Delete “${item.name}”? This cannot be undone.`)) return
    const { error: deleteError } = await supabase.from('inventory_items').delete().eq('id', item.id)
    if (deleteError) setError(deleteError.message)
    else await loadItems()
  }

  const filteredItems = items.filter((item) =>
    `${item.name} ${item.sku ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="page">
      <PageHeader title="Inventory" description="Your private catalog. Teammates only see items attached to an agreement." action={<button className="button button--primary" onClick={openCreate}><Plus size={18} /> Add item</button>} />
      {error && <ErrorMessage message={error} />}
      <div className="toolbar">
        <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your inventory" aria-label="Search inventory" /></label>
        <span>{items.length} item {items.length === 1 ? 'type' : 'types'}</span>
      </div>

      {loading ? <LoadingState /> : filteredItems.length === 0 ? (
        <EmptyState title={search ? 'No matching items' : 'Build your catalog'} description={search ? 'Try a different name or SKU.' : 'Add merchandise before requesting space on a team trip.'} action={!search && <button className="button button--secondary" onClick={openCreate}>Add your first item</button>} />
      ) : (
        <section className="inventory-grid">
          {filteredItems.map((item) => (
            <article className="item-card" key={item.id}>
              <div className="item-card__icon"><Boxes /></div>
              <div className="item-card__actions">
                <button className="icon-button" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`} title="Edit"><Pencil size={17} /></button>
                <button className="icon-button icon-button--danger" onClick={() => void deleteItem(item)} aria-label={`Delete ${item.name}`} title="Delete"><Trash2 size={17} /></button>
              </div>
              <p className="eyebrow">{item.sku || 'No SKU'}</p>
              <h2>{item.name}</h2>
              <p>{item.description || 'No description'}</p>
              <footer><div><span>On hand</span><strong>{item.quantity.toLocaleString()}</strong></div><div><span>Default price</span><strong>{formatMoney(item.default_price_cents)}</strong></div></footer>
            </article>
          ))}
        </section>
      )}

      {modalOpen && (
        <Modal title={editing ? 'Edit inventory item' : 'Add inventory item'} onClose={() => setModalOpen(false)}>
          <form className="form-grid" onSubmit={(event) => void saveItem(event)}>
            <label className="field--wide">Item name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={100} /></label>
            <label>SKU (optional)<input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} maxLength={50} /></label>
            <label>Quantity on hand<input type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required min="0" step="1" /></label>
            <label>Default unit price<input type="number" value={form.defaultPrice} onChange={(event) => setForm({ ...form, defaultPrice: event.target.value })} required min="0" step="0.01" /></label>
            <label className="field--wide">Description (optional)<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} maxLength={500} /></label>
            <div className="form-actions field--wide"><button type="button" className="button button--ghost" onClick={() => setModalOpen(false)}>Cancel</button><button className="button button--primary" disabled={saving}>{saving ? 'Saving…' : 'Save item'}</button></div>
          </form>
        </Modal>
      )}
    </div>
  )
}