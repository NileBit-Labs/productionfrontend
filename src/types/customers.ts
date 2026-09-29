export interface OpenCreditSale {
  sale_id: number
  sale_number: string
  owed: number
  due_date: string | null
  sold_at: string
}

export interface Customer {
  id: number
  name: string
  phone: string | null
  balance: number
  oldest_due_date: string | null
  overdue: boolean
  // Owners/managers only:
  notes?: string | null
  created_at?: string
  open_sales?: OpenCreditSale[]
}

export interface LedgerEntry {
  id: number
  type: 'CREDIT_SALE' | 'PAYMENT' | 'SALE_VOID' | 'REFUND'
  amount: number
  balance_after: number
  note: string | null
  created_at: string
}

export const LEDGER_LABELS: Record<LedgerEntry['type'], string> = {
  CREDIT_SALE: 'Sold on credit',
  PAYMENT: 'Repayment',
  SALE_VOID: 'Sale voided',
  REFUND: 'Refund credited',
}
