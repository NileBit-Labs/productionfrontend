export type StaffRole = 'owner' | 'manager' | 'cashier'

export interface StaffMember {
  id: number
  name: string
  email: string
  phone: string | null
  role: StaffRole
  status: 'active' | 'inactive'
  last_active_at: string | null
  is_you: boolean
}

export interface AuditEntry {
  id: number
  created_at: string
  action: string
  user: { id: number; name: string } | null
  entity: string
  entity_id: number
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

export interface AuditPage {
  range: { from: string; to: string; timezone: string }
  actions: string[]
  page: {
    data: AuditEntry[]
    current_page: number
    last_page: number
    total: number
  }
}
