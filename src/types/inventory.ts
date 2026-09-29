import type { ProductUnit } from '@/types/sales'

export interface ManagedProduct {
  id: number
  name: string
  sku: string | null
  barcode: string | null
  category_id: number | null
  category: string | null
  base_unit: string
  selling_price: number
  current_cost: number
  low_stock_threshold: number
  status: 'active' | 'archived'
  stock: number
  stock_value: number
  is_out: boolean
  is_low: boolean
  units: ProductUnit[]
}

export interface Category {
  id: number
  name: string
  products_count?: number
}

export type MovementType =
  | 'OPENING_STOCK'
  | 'SALE'
  | 'PURCHASE'
  | 'SALE_RETURN'
  | 'PURCHASE_RETURN'
  | 'DAMAGE'
  | 'LOSS'
  | 'ADJUSTMENT'

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  OPENING_STOCK: 'Opening stock',
  SALE: 'Sold',
  PURCHASE: 'Received',
  SALE_RETURN: 'Returned by customer',
  PURCHASE_RETURN: 'Returned to supplier',
  DAMAGE: 'Damaged',
  LOSS: 'Lost',
  ADJUSTMENT: 'Stock adjustment',
}

export interface Movement {
  id: number
  product_id: number
  product_name: string
  unit: string
  type: MovementType
  quantity_delta: number
  unit_cost: number
  reason: string | null
  performed_by: string
  reference: { type: string; id: number; label: string | null } | null
  created_at: string
}

export interface InventorySummary {
  items: number
  low_stock: number
  out_of_stock: number
  stock_value: number
}

export interface Paginated<T> {
  data: T[]
  current_page: number
  last_page: number
  total: number
}
