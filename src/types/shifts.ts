export interface ShiftSummary {
  cash_sales: number
  cash_repayments: number
  cash_refunds: number
  other_methods: { method: string; in: number; out: number }[]
  expected_cash?: number
}

export interface Shift {
  id: number
  cashier_id: number
  opening_cash: number
  expected_cash?: number | null
  actual_cash?: number | null
  variance?: number | null
  opened_at: string
  closed_at: string | null
  close_note: string | null
  cashier?: { id: number; name: string }
  summary?: ShiftSummary
  expected_cash_now?: number
  changed_since_close?: number
}
