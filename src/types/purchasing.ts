import type { PaymentMethod } from '@/types/sales'

export interface OpenPurchase {
  purchase_id: number
  purchase_number: string
  owed: number
  purchase_date: string
}

export interface Supplier {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  balance: number
  open_purchases?: OpenPurchase[]
}

export interface SupplierSummary {
  suppliers: number
  owing: number
  total_owed: number
}

export type PaymentStatus = 'paid' | 'partial' | 'unpaid' | 'cancelled'

export interface PurchaseRow {
  id: number
  purchase_number: string
  status: 'received' | 'cancelled'
  payment_status: PaymentStatus
  supplier: { id: number; name: string }
  purchase_date: string
  reference: string | null
  note: string | null
  total: number
  amount_paid: number
  owed: number
  items_count: number
}

export interface PurchaseLine {
  id: number
  product_id: number
  product_name: string
  base_unit: string
  quantity: number
  unit_name: string | null
  conversion: number
  unit_cost: number
  line_total: number
  base_quantity: number
  base_unit_cost: number
}

export interface PurchaseDetail extends PurchaseRow {
  received_by: string
  cancel_reason: string | null
  cancelled_at: string | null
  items: PurchaseLine[]
  payments: {
    id: number
    amount: number
    method: PaymentMethod
    reference: string | null
    created_at: string
  }[]
}

export interface SupplierLedgerEntry {
  id: number
  type: 'PURCHASE' | 'PAYMENT' | 'PURCHASE_CANCEL'
  amount: number
  note: string | null
  recorded_by: string
  reference: { type: string; id: number } | null
  created_at: string
}

export const LEDGER_LABELS: Record<SupplierLedgerEntry['type'], string> = {
  PURCHASE: 'Bought on credit',
  PAYMENT: 'Payment made',
  PURCHASE_CANCEL: 'Purchase cancelled',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: 'Paid',
  partial: 'Part paid',
  unpaid: 'Unpaid',
  cancelled: 'Cancelled',
}

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, string> = {
  paid: 'ok',
  partial: 'warn',
  unpaid: 'bad',
  cancelled: '',
}
