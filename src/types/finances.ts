export type PaymentType = 'anticipo' | 'abono' | 'pago_final'
export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'otro'
export type ExpenseVisibility = 'all_internal' | 'admin_only'

export interface ExpenseCategory {
  id: string
  name: string
  description: string | null
  is_fixed: boolean
  visibility: ExpenseVisibility
  is_system: boolean
  icon: string | null
  color: string | null
  sort_order: number
  created_at: string
}

export interface Expense {
  id: string
  category_id: string
  amount: number
  currency: string
  description: string
  date: string
  reference: string | null
  receipt_url: string | null
  notes: string | null
  project_id: string | null
  period: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joins
  category?: ExpenseCategory
  project?: { id: string; title: string } | null
}

export interface ProjectPayment {
  id: string
  project_id: string
  quote_id: string | null
  type: PaymentType
  amount: number
  currency: string
  method: PaymentMethod
  reference: string | null
  paid_at: string
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joins
  project?: { id: string; title: string } | null
}

export interface PayrollEntry {
  id: string
  employee_name: string
  employee_role: string | null
  period_start: string
  period_end: string
  base_salary: number
  bonuses: number
  deductions: number
  net_total: number
  notes: string | null
  paid_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProjectFinancialSummary {
  project_id: string
  project_title: string
  agreed_amount: number
  received_amount: number
  direct_costs: number
  margin: number
  margin_pct: number
  balance_due: number
  payments: ProjectPayment[]
}

export interface MonthlyFinancialSummary {
  period: string        // 'YYYY-MM'
  income: number
  expenses: number      // total egresos = op_fixed + op_variable + payroll
  op_fixed: number      // gastos fijos (expense_categories.is_fixed = true)
  op_variable: number   // gastos variables (expense_categories.is_fixed = false)
  payroll: number       // nómina (tabla payroll_entries)
  net: number
  cumulative_net: number
}

export interface SankeyNode {
  id: string
  label: string
  value: number
  color?: string
}

export interface SankeyLink {
  source: string
  target: string
  value: number
  color?: string
}

export interface SankeyData {
  nodes: SankeyNode[]
  links: SankeyLink[]
}

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  anticipo: 'Anticipo',
  abono: 'Abono',
  pago_final: 'Pago Final',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque',
  otro: 'Otro',
}
