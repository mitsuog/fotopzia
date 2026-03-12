export type DealStage = 'lead' | 'prospect' | 'proposal' | 'won' | 'lost'
export type ActivityType = 'note' | 'call' | 'email' | 'meeting' | 'task' | 'stage_change' | 'file'

export interface Contact {
  id: string
  company_name: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  source: string | null
  tags: string[] | null
  assigned_to: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface DealContactSummary {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  company_name: string | null
  source: string | null
  tags: string[] | null
}

export interface Deal {
  id: string
  contact_id: string
  title: string
  stage: DealStage
  value: number | null
  currency: string
  probability: number | null
  expected_close: string | null
  lost_reason: string | null
  lost_stage: string | null
  lost_notes: string | null
  notes: string | null
  assigned_to: string | null
  created_by: string
  position: number
  created_at: string
  updated_at: string
  // joined
  contact?: DealContactSummary
}

export interface Activity {
  id: string
  contact_id: string | null
  deal_id: string | null
  type: ActivityType
  subject: string | null
  body: string | null
  due_at: string | null
  completed: boolean
  completed_at: string | null
  created_by: string
  created_at: string
}

export interface LostDetails {
  lost_reason: string   // 'precio' | 'competencia' | 'sin_presupuesto' | 'sin_respuesta' | 'otro'
  lost_stage: string    // 'lead' | 'prospect' | 'proposal'
  lost_notes?: string
}
