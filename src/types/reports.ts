export interface DateRange {
  from: string
  to: string
  timezone?: string
}

export interface RecentSale {
  id: number
  sale_number: string
  total: number
  status: string
  cashier: string | null
  customer: string | null
  created_at: string
}

export interface DashboardOwnerManager {
  role: 'owner' | 'manager'
  date: string
  today: {
    net_sales: number
    sales_count: number
    average_sale: number
    refunds: number
    credit_given: number
    expenses: number
    gross_profit?: number
  }
  yesterday_net_sales: number
  week: { net_sales: number; previous_net_sales: number }
  series: { date: string; net_sales: number; sales_count: number }[]
  top_products: { product_id: number; name: string; quantity: number; revenue: number }[]
  payment_methods: { method: string; amount: number }[]
  stock: {
    products: number
    out: number
    low: number
    attention: {
      id: number
      name: string
      unit: string
      stock: number
      low_stock_level: number
      status: 'out' | 'low'
    }[]
  }
  debt: {
    total_owed: number
    customers_owing: number
    overdue: number
    top: { id: number; name: string; balance: number; overdue: number; days_overdue: number }[]
  }
  recent_sales: RecentSale[]
}

export interface DashboardCashier {
  role: 'cashier'
  date: string
  today: { sales_count: number; total: number; average_sale: number }
  recent_sales: RecentSale[]
}

export type Dashboard = DashboardOwnerManager | DashboardCashier

export interface SalesReport {
  range: DateRange
  summary: {
    sales_count: number
    gross_sales: number
    discounts: number
    refund_count: number
    refunds: number
    net_sales: number
    average_sale: number
    credit_given: number
    voided_count: number
    voided_value: number
  }
  daily: {
    date: string
    sales_count: number
    gross_sales: number
    refunds: number
    net_sales: number
  }[]
  payment_methods: { method: string; amount: number }[]
  cashiers: { user_id: number; name: string; sales_count: number; total: number }[]
  products: { product_id: number; name: string; quantity: number; revenue: number }[]
}

export interface ProfitReport {
  range: DateRange
  summary: {
    net_sales: number
    cost_of_goods: number
    gross_profit: number
    margin: number | null
    expenses: number
    operating_profit: number
  }
  daily: {
    date: string
    net_sales: number
    cost_of_goods: number
    gross_profit: number
    expenses: number
    operating_profit: number
  }[]
  expenses: { category: string; amount: number }[]
  products: {
    product_id: number
    name: string
    quantity: number
    revenue: number
    cost: number
    profit: number
    margin: number | null
  }[]
}

export type StockStatus = 'out' | 'low' | 'ok'

export interface StockRow {
  id: number
  name: string
  sku: string
  barcode: string
  unit: string
  stock: number
  low_stock_level: number
  status: StockStatus
  value_at_cost?: number
  value_at_retail?: number
}

export interface StockReport {
  summary: {
    products: number
    out: number
    low: number
    in_stock: number
    value_at_cost?: number
    value_at_retail?: number
  }
  page: { data: StockRow[]; current_page: number; last_page: number; total: number }
}

export interface DebtReport {
  as_of: string
  summary: { total_owed: number; customers_owing: number; overdue: number }
  aging: { bucket: string; amount: number }[]
  customers: {
    id: number
    name: string
    phone: string | null
    balance: number
    open_sales: number
    oldest_debt_days: number | null
    overdue: number
    days_overdue: number
  }[]
}
