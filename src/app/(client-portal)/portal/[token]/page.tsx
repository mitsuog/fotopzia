import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ token: string }>
}

type PortalContact = {
  first_name: string
  last_name: string
  email: string | null
}

type PortalTokenWithContact = {
  id: string
  expires_at: string | null
  access_count: number
  contacts: PortalContact | null
}

export default async function ClientPortalPage({ params }: PageProps) {
  const { token } = await params

  const { data: portalToken } = await supabaseAdmin
    .from('client_portal_tokens')
    .select('*, contacts(first_name, last_name, email)')
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (!portalToken) {
    notFound()
  }

  // Verificar si expiró
  if (portalToken.expires_at && new Date(portalToken.expires_at) < new Date()) {
    notFound()
  }

  // Actualizar último acceso
  await supabaseAdmin
    .from('client_portal_tokens')
    .update({
      last_accessed_at: new Date().toISOString(),
      access_count: (portalToken.access_count ?? 0) + 1,
    })
    .eq('id', portalToken.id)

  const contact = (portalToken as unknown as PortalTokenWithContact).contacts

  return (
    <div className="min-h-screen bg-[#F0EEE8]">
      <header className="bg-[#1C2B4A] text-white py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#C49A2A] flex items-center justify-center">
            <span className="text-white text-sm font-bold">F</span>
          </div>
          <span className="font-semibold">Fotopzia Studio</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-6">
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#1C2B4A' }}>
          Portal de Cliente
        </h1>
        {contact && (
          <p className="text-gray-600 mb-8">
            Bienvenido, {contact.first_name} {contact.last_name}
          </p>
        )}

        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {[
            { label: 'Mi Galería', href: `${token}/gallery`, icon: '🖼️' },
            { label: 'Cotizaciones', href: `${token}/quotes`, icon: '📄' },
            { label: 'Contratos', href: `${token}/contracts`, icon: '✍️' },
          ].map(item => (
            <a
              key={item.label}
              href={`/portal/${item.href}`}
              className="bg-[#FAFAF7] rounded-lg p-6 border border-[#E8E5DC] flex flex-col items-center gap-3 hover:shadow-md transition-shadow"
            >
              <span className="text-3xl">{item.icon}</span>
              <span className="font-medium" style={{ color: '#1C2B4A' }}>
                {item.label}
              </span>
            </a>
          ))}
        </div>
      </main>
    </div>
  )
}
