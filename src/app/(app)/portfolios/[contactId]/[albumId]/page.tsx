import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'
import { MediaUploader } from '@/components/portfolios/MediaUploader'

export const dynamic = 'force-dynamic'

interface AlbumDetailPageProps {
  params: Promise<{ contactId: string; albumId: string }>
}

async function togglePublish(albumId: string, current: boolean) {
  'use server'
  const supabase = await createClient()
  await supabase.from('albums').update({ is_published: !current }).eq('id', albumId)
  revalidatePath(`/portfolios`)
}

async function deleteMediaItem(itemId: string, storagePath: string) {
  'use server'
  await supabaseAdmin.storage.from('media-private').remove([storagePath])
  await supabaseAdmin.from('media_items').delete().eq('id', itemId)
  revalidatePath(`/portfolios`)
}

export default async function AlbumDetailPage({ params }: AlbumDetailPageProps) {
  const { contactId, albumId } = await params
  const supabase = await createClient()

  const { data: album } = await supabase
    .from('albums')
    .select('id, title, description, is_published, contact_id, contact:contacts(first_name, last_name)')
    .eq('id', albumId)
    .eq('contact_id', contactId)
    .single()

  if (!album) notFound()

  const { data: items } = await supabaseAdmin
    .from('media_items')
    .select('id, filename, mime_type, storage_path, caption, is_favorite, sort_order, size_bytes')
    .eq('album_id', albumId)
    .order('sort_order', { ascending: true })

  // Generate signed URLs for existing media
  const media = await Promise.all(
    (items ?? []).map(async item => {
      const { data } = await supabaseAdmin.storage
        .from('media-private')
        .createSignedUrl(item.storage_path, 3600)
      return { ...item, signed_url: data?.signedUrl ?? null }
    }),
  )

  const contactName = album.contact
    ? `${album.contact.first_name} ${album.contact.last_name}`
    : 'Sin nombre'

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

      <PageHeader
        title={album.title}
        subtitle={`Cliente: ${contactName} · ${media.length} ${media.length === 1 ? 'archivo' : 'archivos'}`}
        badge="Content"
      />

      {/* Album header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-stone bg-white p-4">
        <div>
          {album.description && (
            <p className="text-sm text-gray-500">{album.description}</p>
          )}
          <span
            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              album.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {album.is_published ? 'Publicado en portal del cliente' : 'Borrador — no visible para el cliente'}
          </span>
        </div>
        <form action={togglePublish.bind(null, album.id, album.is_published)}>
          <button
            type="submit"
            className={`rounded-lg border px-4 py-1.5 text-xs font-semibold transition-colors ${
              album.is_published
                ? 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            {album.is_published ? 'Despublicar' : 'Publicar en portal'}
          </button>
        </form>
      </div>

      {/* Uploader */}
      <div className="rounded-2xl border border-brand-stone bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-brand-navy">Subir archivos</h2>
        <MediaUploader contactId={contactId} albumId={albumId} />
        <p className="mt-3 text-xs text-gray-400">
          Los archivos subidos aparecerán en la galería del cliente una vez que publiques el álbum.
          Recarga la página para verlos en el listado de abajo.
        </p>
      </div>

      {/* Media grid */}
      <div className="rounded-2xl border border-brand-stone bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-brand-navy">
          Archivos en este álbum ({media.length})
        </h2>

        {media.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no hay archivos. Usa el uploader de arriba.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {media.map(item => (
              <div key={item.id} className="group relative">
                {item.mime_type.startsWith('image/') ? (
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-brand-canvas">
                    {item.signed_url ? (
                      <Image
                        src={item.signed_url}
                        alt={item.caption ?? item.filename}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-gray-400">
                        Sin vista previa
                      </div>
                    )}
                  </div>
                ) : item.mime_type.startsWith('video/') ? (
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-brand-navy/10 flex items-center justify-center">
                    <svg className="h-8 w-8 text-brand-navy/40" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                ) : null}

                <p className="mt-1 truncate text-[11px] text-gray-500">{item.filename}</p>

                {/* Delete */}
                <form
                  action={deleteMediaItem.bind(null, item.id, item.storage_path)}
                  className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <button
                    type="submit"
                    title="Eliminar"
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
