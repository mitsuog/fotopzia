import { redirect } from 'next/navigation'

export default function KanbanPage() {
  redirect('/crm?view=kanban')
}
