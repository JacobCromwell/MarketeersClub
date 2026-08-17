import type { AgreementStatus } from './domain/agreements'

export interface Profile {
  id: string
  display_name: string
  created_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  profile_id: string
  role: 'owner' | 'member'
  status: 'pending' | 'active'
  profiles?: Profile
}

export interface Team {
  id: string
  name: string
  owner_id: string
  created_at: string
  team_members?: TeamMember[]
}

export interface InventoryItem {
  id: string
  owner_id: string
  name: string
  sku: string | null
  description: string | null
  quantity: number
  default_price_cents: number
  created_at: string
  updated_at: string
}

export interface Trip {
  id: string
  team_id: string
  seller_id: string
  title: string
  event_at: string
  pickup_at: string
  pickup_location: string
  return_at: string
  return_location: string
  note: string | null
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string
  teams?: Pick<Team, 'id' | 'name'>
  profiles?: Pick<Profile, 'id' | 'display_name'>
}

export interface Agreement {
  id: string
  trip_id: string
  item_id: string
  owner_id: string
  seller_id: string
  quantity: number
  unit_price_cents: number
  commission_per_item_cents: number
  sold_quantity: number | null
  terms_version: number
  owner_approved_version: number | null
  seller_approved_version: number | null
  status: AgreementStatus
  created_at: string
  updated_at: string
  inventory_items?: Pick<InventoryItem, 'id' | 'name' | 'quantity'>
  trips?: Pick<Trip, 'id' | 'title' | 'event_at'>
  owner?: Pick<Profile, 'id' | 'display_name'>
  seller?: Pick<Profile, 'id' | 'display_name'>
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  href: string | null
  read_at: string | null
  created_at: string
}