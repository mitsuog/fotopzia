export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'expired'
export type ContractStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'rejected' | 'voided'

export interface QuoteLineItem {
  id: string
  quote_id: string
  sort_order: number
  description: string
  quantity: number
  unit_price: number
  discount_pct: number
  total: number
  category: string | null
}

export interface Quote {
  id: string
  quote_number: string
  contact_id: string
  deal_id: string | null
  title: string
  status: QuoteStatus
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  currency: string
  valid_until: string | null
  notes: string | null
  internal_notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  // joined
  contact?: {
    id: string
    first_name: string
    last_name: string
    email?: string | null
    company_name: string | null
  }
  line_items?: QuoteLineItem[]
}

export interface Contract {
  id: string
  contract_number: string
  contact_id: string
  quote_id: string | null
  title: string
  content: string
  status: ContractStatus
  signed_by: string | null
  signed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  contact?: { id: string; first_name: string; last_name: string }
}

export type ApprovalFlowStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled'
export type ApprovalStepStatus = 'pending' | 'approved' | 'rejected' | 'skipped'
export type ApprovalEntityType = 'quote' | 'contract' | 'asset' | 'custom'

export interface ApprovalStep {
  id: string
  flow_id: string
  step_order: number
  approver_type: 'internal' | 'client'
  approver_id: string | null
  approver_email: string | null
  approver_name: string | null
  status: ApprovalStepStatus
  token: string | null
  comment: string | null
  responded_at: string | null
}

export interface ApprovalFlow {
  id: string
  entity_id: string
  entity_type: ApprovalEntityType
  status: ApprovalFlowStatus
  title: string
  created_by: string
  created_at: string
  updated_at: string
  steps?: ApprovalStep[]
}
