export function normalizeNullable(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'admin'
}

export function isAdminOrPmRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'project_manager'
}

export async function getUserRole(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  return data?.role ?? null
}

export async function logEquipmentActivity(
  supabase: any,
  input: {
    equipmentId: string
    eventType: string
    actorId: string | null
    payload?: Record<string, unknown>
  },
): Promise<void> {
  await supabase
    .from('equipment_activity_log')
    .insert({
      equipment_id: input.equipmentId,
      event_type: input.eventType,
      actor_id: input.actorId,
      payload: input.payload ?? {},
    })
}
