import { apiFetch } from './api'
import type { ExpenseCategory, MeasurementUnit, ProductionBatch, ProductionPage, ProductionProduct, ProductionReport, Recipe, WastageRecord } from '@/types/production'

type Body = Record<string, unknown>
const query = (params: Record<string, string | number | undefined>) => { const q = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') q.set(key, String(value)) }); return q.toString() ? `?${q}` : '' }

export const productionApi = {
  measurementUnits: {
    list: () => apiFetch<MeasurementUnit[]>('/measurement-units'),
    create: (body: Body) => apiFetch<MeasurementUnit>('/measurement-units', { method: 'POST', body }),
    update: (id: number, body: Body) => apiFetch<MeasurementUnit>(`/measurement-units/${id}`, { method: 'PATCH', body }),
    remove: (id: number) => apiFetch<void>(`/measurement-units/${id}`, { method: 'DELETE' }),
  },
  expenseCategories: {
    list: (includeInactive = false) => apiFetch<ExpenseCategory[]>(`/expense-categories${includeInactive ? '?include_inactive=1' : ''}`),
    create: (body: Body) => apiFetch<ExpenseCategory>('/expense-categories', { method: 'POST', body }),
    update: (id: number, body: Body) => apiFetch<ExpenseCategory>(`/expense-categories/${id}`, { method: 'PATCH', body }),
  },
  products: {
    list: (kind?: string) => apiFetch<ProductionPage<ProductionProduct>>(`/products${query({ kind, status: 'active' })}`),
    create: (body: Body) => apiFetch<ProductionProduct>('/products', { method: 'POST', body }),
    update: (id: number, body: Body) => apiFetch<ProductionProduct>(`/products/${id}`, { method: 'PATCH', body }),
  },
  recipes: {
    list: (params: { status?: string; search?: string } = {}) => apiFetch<ProductionPage<Recipe>>(`/recipes${query(params)}`),
    create: (body: Body) => apiFetch<Recipe>('/recipes', { method: 'POST', body }),
    get: (id: number) => apiFetch<Recipe>(`/recipes/${id}`),
    update: (id: number, body: Body) => apiFetch<Recipe>(`/recipes/${id}`, { method: 'PATCH', body }),
    archive: (id: number) => apiFetch<Recipe>(`/recipes/${id}/archive`, { method: 'POST' }),
    restore: (id: number) => apiFetch<Recipe>(`/recipes/${id}/restore`, { method: 'POST' }),
  },
  batches: {
    list: (params: Record<string, string | number | undefined> = {}) => apiFetch<ProductionPage<ProductionBatch>>(`/production/batches${query(params)}`),
    create: (body: Body) => apiFetch<ProductionBatch>('/production/batches', { method: 'POST', body }),
    get: (id: number) => apiFetch<ProductionBatch>(`/production/batches/${id}`),
    update: (id: number, body: Body) => apiFetch<ProductionBatch>(`/production/batches/${id}`, { method: 'PATCH', body }),
    complete: (id: number, body: Body) => apiFetch<ProductionBatch>(`/production/batches/${id}/complete`, { method: 'POST', body }),
    cancel: (id: number, reason: string) => apiFetch<ProductionBatch>(`/production/batches/${id}/cancel`, { method: 'POST', body: { reason } }),
  },
  wastage: {
    list: (params: Record<string, string | number | undefined> = {}) => apiFetch<{ total_cost: number; records: ProductionPage<WastageRecord> }>(`/wastage${query(params)}`),
    create: (body: Body) => apiFetch<WastageRecord>('/wastage', { method: 'POST', body }),
  },
  reports: {
    production: (from?: string, to?: string) => apiFetch<ProductionReport>(`/reports/production${query({ from, to })}`),
  },
}
