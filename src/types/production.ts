import type { Paginated } from './inventory'

export type ProductKind = 'raw_material' | 'packaging' | 'finished_good'
export type ExpenseType = 'operating' | 'direct_labour' | 'direct_production'
export type BatchStatus = 'draft' | 'completed' | 'cancelled'

export interface MeasurementUnit { id: number; name: string; symbol: string; dimension: string }
export interface ExpenseCategory { id: number; name: string; default_type: ExpenseType; is_active: boolean }
export interface ProductionProduct { id: number; name: string; kind: ProductKind; base_unit: string; stock: number; family: string | null; size_label: string | null; output_equivalent: number | null; shelf_life_days: number | null }
export interface RecipeItem { product_id: number; product_name?: string; quantity: number; note: string | null; unit_cost?: number; estimated_cost?: number }
export interface Recipe { id: number; name: string; family: string | null; yield_quantity: number; yield_unit: string; instructions: string | null; status?: 'active' | 'archived'; items?: RecipeItem[]; estimated_cost?: number; estimated_cost_per_yield_unit?: number }
export interface BatchLine { product_id: number; product_name?: string; quantity?: number; planned_quantity?: number; actual_quantity?: number; output_equivalent?: number; expiry_date?: string | null; reason?: string | null }
export interface ProductionBatch { id: number; batch_number: string; name: string; status: BatchStatus; production_date: string; expiry_date: string | null; planned_yield: number; yield_unit: string; output_quantity?: number; total_cost?: number; recipe?: { id: number; name: string } | null; inputs?: BatchLine[]; outputs?: BatchLine[] }
export interface WastageRecord { id: number; product_id: number; product_name?: string; quantity: number; reason: string; stage: string; wastage_date: string; cost?: number }
export interface ProductionReport { summary: Record<string, number>; products: Record<string, unknown>[]; batches: ProductionBatch[]; wastage: Record<string, unknown>; stock: Record<string, unknown>; low_inputs: ProductionProduct[]; expiring: Record<string, unknown>[] }
export type ProductionPage<T> = Paginated<T>
