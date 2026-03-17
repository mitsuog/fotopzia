import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { PageHeader } from '@/components/layout/PageHeader'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function toggleAlbumPublish(albumId: string, contactId: string, currentState: boolean) {
  'use server'
  const supabase = await createClient()
  await supabase.from('albums').update({ is_published: !currentState }).eq('id', albumId)
  revalidatePath('/portfolios')
  revalidatePath(`/portfolios/${contactId}/${albumId}`)
}

export default async function PortfoliosPage() {
  const supabase = await createClient()

  const { data: albums } = await supabase
    .from('albums')
    .select('id, contact_id, title, description, is_published, contact:contacts(first_name, last_name)')
    .order('created_at', { ascending: false })

  // Count media per album
  const albumIds = (albums ?? []).map(a => a.id)
  const mediaCounts: Record<string, number> = {}
  if (albumIds.length > 0) {
    const { data: counts } = await supabase
      .from('media_items')
      .select('album_id')
      .in('album_id', albumIds)
    ;(counts ?? []).forEach(row => {
      mediaCounts[row.album_id] = (mediaCounts[row.album_id] ?? 0) + 1
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Portafolios" subtitle={`${albums?.length ?? 0} álbumes`} badge="Content" />
        <Link
          href="/portfolios/new"
          className="shrink-0 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-light transition-colors"
        >
          + Nuevo álbum
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(albums ?? []).length === 0 ? (
          <div className="col-span-full rounded-xl border border-brand-stone/80 bg-white/80 p-8 text-center text-gray-400 backdrop-blur">
            Aún no hay álbumes creados.
          </div>
        ) : (
          albums?.map(album => {
            const count = mediaCounts[album.id] ?? 0
            const detailHref = `/portfolios/${album.contact_id}/${album.id}`
            return (
              <div
                key={album.id}
                className="flex flex-col rounded-xl border border-brand-stone/80 bg-white/80 p-4 shadow-[0_12px_26px_-20px_rgba(28,43,74,0.45)] backdrop-blur"
              >
                <Link href={detailHref} className="group">
                  <p className="font-semibold text-brand-navy group-hover:text-brand-gold transition-colors">
                    {album.title}
                  </p>
                </Link>
                {album.description && (
                  <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{album.description}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Cliente:{' '}
                  {album.contact
                    ? `${album.contact.first_name} ${album.contact.last_name}`
                    : '-'}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {count} {count === 1 ? 'archivo' : 'archivos'}
                </p>

                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      album.is_published
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {album.is_published ? 'Publicado' : 'Borrador'}
                  </span>

                  <div className="flex items-center gap-2">
                    <Link
                      href={detailHref}
                      className="rounded-lg border border-brand-stone px-3 py-1 text-xs font-medium text-brand-navy hover:bg-brand-canvas transition-colors"
                    >
                      Abrir
                    </Link>
                    <form action={toggleAlbumPublish.bind(null, album.id, album.contact_id, album.is_published)}>
                      <button
                        type="submit"
                        className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                          album.is_published
                            ? 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                            : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {album.is_published ? 'Despublicar' : 'Publicar'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
