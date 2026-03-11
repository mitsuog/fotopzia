import { PageHeader } from '@/components/layout/PageHeader'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()

  const [{ data: users }, { data: profile }, { count: rolesCount }, { count: permissionsCount }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, role, is_active').order('created_at', { ascending: false }),
    supabase.from('profiles').select('full_name, role').single(),
    supabase.from('roles').select('*', { count: 'exact', head: true }),
    supabase.from('permissions').select('*', { count: 'exact', head: true }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="Configuracion" subtitle="Administra usuarios, roles y permisos del sistema" badge="Control Plane" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="rounded-xl border border-brand-stone/80 bg-white/80 p-4 backdrop-blur">
          <p className="text-xs text-gray-500">Usuarios</p>
          <p className="text-2xl font-semibold text-brand-navy">{users?.length ?? 0}</p>
        </div>
        <div className="rounded-xl border border-brand-stone/80 bg-white/80 p-4 backdrop-blur">
          <p className="text-xs text-gray-500">Usuarios activos</p>
          <p className="text-2xl font-semibold text-brand-navy">{users?.filter(u => u.is_active).length ?? 0}</p>
        </div>
        <div className="rounded-xl border border-brand-stone/80 bg-white/80 p-4 backdrop-blur">
          <p className="text-xs text-gray-500">Mi rol</p>
          <p className="text-2xl font-semibold capitalize text-brand-navy">{profile?.role ?? '-'}</p>
        </div>
        <div className="rounded-xl border border-brand-stone/80 bg-white/80 p-4 backdrop-blur">
          <p className="text-xs text-gray-500">Roles configurados</p>
          <p className="text-2xl font-semibold text-brand-navy">{rolesCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-brand-stone/80 bg-white/80 p-4 backdrop-blur">
          <p className="text-xs text-gray-500">Permisos</p>
          <p className="text-2xl font-semibold text-brand-navy">{permissionsCount ?? 0}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-brand-stone/80 bg-white/80 shadow-[0_12px_26px_-20px_rgba(28,43,74,0.45)] backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
            <tr className="border-b border-brand-stone bg-brand-canvas/80">
              <th className="px-4 py-3 text-left font-semibold text-brand-navy">Nombre</th>
              <th className="px-4 py-3 text-left font-semibold text-brand-navy">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-brand-navy">Rol</th>
              <th className="px-4 py-3 text-left font-semibold text-brand-navy">Estado</th>
            </tr>
            </thead>
            <tbody>
            {(users ?? []).map(user => (
              <tr key={user.id} className="border-b border-brand-stone/50 last:border-0">
                <td className="px-4 py-3 font-medium text-brand-navy">{user.full_name}</td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3 capitalize text-gray-700">{user.role}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                      user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
