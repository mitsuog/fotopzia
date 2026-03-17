import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'

export const dynamic = 'force-dynamic'

interface NewAlbumPageProps {
  searchParams: Promise<{ contactId?: string }>
}

async function createAlbum(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const contactId = formData.get('contact_id') as string
  const title = (formData.get('title') as string).trim()
  const description = (formData.get('description') as string).trim() || null

  const { data: album, error } = await supabase
    .from('albums')
    .insert({
      contact_id: contactId,
      title,
      description,
      is_published: false,
      sort_order: 0,
      created_by: user.id,
    })
    .select('id, contact_id')
    .single()

  if (error || !album) return

  redirect(`/portfolios/${album.contact_id}/${album.id}`)
}

export default async function NewAlbumPage({ searchParams }: NewAlbumPageProps) {
  const { contactId: defaultContactId } = await searchParams
  const supabase = await createClient()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, company_name')
    .order('first_name')

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center gap-2">
        <Link
          href="/portfolios"
          className="inline-flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-brand-navy"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Portafolios
        </Link>
      </div>

      <PageHeader title="Nuevo álbum" badge="Content" />

      <div className="rounded-2xl border border-brand-stone bg-white p-6">
        <form action={createAlbum} className="space-y-5 max-w-lg">
          <div>
            <label className="block text-xs font-semibold text-brand-navy mb-1.5">
              Cliente <span className="text-red-500">*</span>
            </label>
            <select
              name="contact_id"
              required
              defaultValue={defaultContactId ?? ''}
              className="w-full rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm text-brand-navy focus:border-brand-gold focus:outline-none"
            >
              <option value="" disabled>Seleccionar cliente…</option>
              {(contacts ?? []).map(c => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                  {c.company_name ? ` · ${c.company_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-navy mb-1.5">
              Título del álbum <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              required
              placeholder="Ej. Boda Ana & Luis – Sesión principal"
              className="w-full rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm text-brand-navy placeholder:text-gray-400 focus:border-brand-gold focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-navy mb-1.5">
              Descripción (opcional)
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Notas sobre el álbum…"
              className="w-full rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm text-brand-navy placeholder:text-gray-400 focus:border-brand-gold focus:outline-none resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              className="rounded-lg bg-brand-navy px-5 py-2 text-sm font-semibold text-white hover:bg-brand-navy-light transition-colors"
            >
              Crear álbum
            </button>
            <Link
              href="/portfolios"
              className="rounded-lg border border-brand-stone px-5 py-2 text-sm font-medium text-brand-navy hover:bg-brand-canvas transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
