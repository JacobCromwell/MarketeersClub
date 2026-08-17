import { AlertCircle, Inbox, LoaderCircle, X } from 'lucide-react'
import type { ReactNode } from 'react'

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  )
}

export function LoadingState() {
  return (
    <div className="state-message">
      <LoaderCircle className="spin" />
      <span>Loading…</span>
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <Inbox size={28} />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="alert alert--error" role="alert">
      <AlertCircle size={18} />
      {message}
    </div>
  )
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </header>
        {children}
      </section>
    </div>
  )
}