import { format } from 'date-fns'

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function formatDateTime(value: string): string {
  return format(new Date(value), 'MMM d, yyyy · h:mm a')
}

export function dollarsToCents(value: string): number {
  return Math.round(Number.parseFloat(value || '0') * 100)
}