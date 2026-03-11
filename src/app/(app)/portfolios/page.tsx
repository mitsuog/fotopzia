import { PageHeader } from '@/components/layout/PageHeader'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PortfoliosPage() {
  const supabase = await createClient()

  const { data: albums } = await supabase
    .from('albums')
    .select('id, title, is_published, contact:contacts(first_name, last_name)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader title="Portafolios" subtitle={`${albums?.length ?? 0} albumes disponibles`} badge="Content" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(albums ?? []).length === 0 ? (
          <div className="col-span-full rounded-xl border border-brand-stone/80 bg-white/80 p-8 text-center text-gray-400 backdrop-blur">
            Aun no hay albumes creados.
          </div>
        ) : (
          albums?.map(album => (
            <div
              key={album.id}
              className="rounded-xl border border-brand-stone/80 bg-white/80 p-4 shadow-[0_12px_26px_-20px_rgba(28,43,74,0.45)] backdrop-blur"
            >
              <p className="font-semibold text-brand-navy">{album.title}</p>
              <p className="mt-1 text-xs text-gray-500">
                Cliente: {album.contact ? `${album.contact.first_name} ${album.contact.last_name}` : '-'}
              </p>
              <span
                className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs ${
                  album.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {album.is_published ? 'Publicado' : 'Borrador'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
