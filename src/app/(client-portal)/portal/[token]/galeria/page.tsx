import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPortalAccessByToken, touchPortalAccess } from '@/lib/portal/token'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PortalShell } from '@/components/portal/PortalShell'

export const dynamic = 'force-dynamic'

interface GaleriaPageProps {
  params: Promise<{ token: string }>
}

interface MediaItem {
  id: string
  filename: string
  mime_type: string
  width: number | null
  height: number | null
  duration_secs: number | null
  caption: string | null
  is_favorite: boolean
  sort_order: number
  storage_path: string
  signed_url: string | null
}

interface AlbumWithMedia {
  id: string
  title: string
  description: string | null
  cover_signed_url: string | null
  media_count: number
  media: MediaItem[]
}

export default async function PortalGaleriaPage({ params }: GaleriaPageProps) {
  const { token } = await params
  const { access } = await getPortalAccessByToken(token)
  if (!access) notFound()

  await touchPortalAccess(access)

  // Gate: contrato firmado
  const { count: signedContracts } = await supabaseAdmin
    .from('contracts')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', access.contact_id)
    .eq('status', 'signed')

  const galleryLocked = !signedContracts || signedContracts === 0

  let albums: AlbumWithMedia[] = []

  if (!galleryLocked) {
    const { data: rawAlbums } = await supabaseAdmin
      .from('albums')
      .select('id, title, description, cover_url, sort_order')
      .eq('contact_id', access.contact_id)
      .eq('is_published', true)
      .order('sort_order', { ascending: true })

    albums = await Promise.all(
      (rawAlbums ?? []).map(async album => {
        const { data: items } = await supabaseAdmin
          .from('media_items')
          .select('id, filename, mime_type, width, height, duration_secs, caption, is_favorite, sort_order, storage_path')
          .eq('album_id', album.id)
          .order('sort_order', { ascending: true })

        const media: MediaItem[] = await Promise.all(
          (items ?? []).map(async item => {
            const { data: signedData } = await supabaseAdmin.storage
              .from('media-private')
              .createSignedUrl(item.storage_path, 3600)
            return { ...item, signed_url: signedData?.signedUrl ?? null }
          }),
        )

        let cover_signed_url: string | null = null
        if (album.cover_url) {
          if (album.cover_url.startsWith('http')) {
            cover_signed_url = album.cover_url
          } else {
            const { data: coverData } = await supabaseAdmin.storage
              .from('media-private')
              .createSignedUrl(album.cover_url, 3600)
            cover_signed_url = coverData?.signedUrl ?? null
          }
        }

        return {
          id: album.id,
          title: album.title,
          description: album.description,
          cover_signed_url,
          media_count: media.length,
          media,
        }
      }),
    )
  }

  const totalPhotos = albums.reduce(
    (acc, a) => acc + a.media.filter(m => m.mime_type.startsWith('image/')).length,
    0,
  )
  const totalVideos = albums.reduce(
    (acc, a) => acc + a.media.filter(m => m.mime_type.startsWith('video/')).length,
    0,
  )

  return (
    <PortalShell
      token={token}
      active="galeria"
      title="Galería"
      description={`Cliente: ${access.contacts ? `${access.contacts.first_name} ${access.contacts.last_name}` : 'Sin nombre'}`}
    >
      {galleryLocked ? (
        <section className="rounded-2xl border border-brand-stone bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-canvas">
            <svg
              className="h-7 w-7 text-brand-navy/50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-brand-navy">Galería no disponible aún</h2>
          <p className="mt-2 text-sm text-gray-500">
            Tu galería estará disponible una vez que hayas firmado tu contrato.
          </p>
          <Link
            href={`/portal/${token}/documents`}
            className="mt-4 inline-flex items-center rounded-lg bg-brand-navy px-4 py-2 text-xs font-semibold text-white hover:bg-brand-navy-light"
          >
            Ver documentos pendientes
          </Link>
        </section>
      ) : albums.length === 0 ? (
        <section className="rounded-2xl border border-brand-stone bg-white p-8 text-center">
          <p className="text-sm text-gray-500">
            El equipo Fotopzia está preparando tu galería. Pronto tendrás acceso a tus fotos y videos.
          </p>
        </section>
      ) : (
        <>
          {/* Summary */}
          <section className="rounded-2xl border border-brand-stone bg-white p-5">
            <div className="flex flex-wrap gap-4 text-sm text-brand-navy">
              <span>
                <span className="font-semibold">{albums.length}</span>{' '}
                {albums.length === 1 ? 'álbum' : 'álbumes'}
              </span>
              {totalPhotos > 0 && (
                <span>
                  <span className="font-semibold">{totalPhotos}</span>{' '}
                  {totalPhotos === 1 ? 'foto' : 'fotos'}
                </span>
              )}
              {totalVideos > 0 && (
                <span>
                  <span className="font-semibold">{totalVideos}</span>{' '}
                  {totalVideos === 1 ? 'video' : 'videos'}
                </span>
              )}
            </div>
          </section>

          {/* Albums */}
          {albums.map(album => (
            <section key={album.id} className="rounded-2xl border border-brand-stone bg-white p-5">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-brand-navy">{album.title}</h2>
                {album.description && (
                  <p className="mt-1 text-sm text-gray-500">{album.description}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  {album.media_count} {album.media_count === 1 ? 'archivo' : 'archivos'}
                </p>
              </div>

              {album.media.length === 0 ? (
                <p className="text-sm text-gray-400">Este álbum está vacío.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                  {album.media.map(item => (
                    <div key={item.id} className="group relative">
                      {item.mime_type.startsWith('image/') ? (
                        <div className="relative aspect-square overflow-hidden rounded-lg bg-brand-canvas">
                          {item.signed_url ? (
                            <Image
                              src={item.signed_url}
                              alt={item.caption ?? item.filename}
                              fill
                              unoptimized
                              className="object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-gray-400">
                              No disponible
                            </div>
                          )}
                          {/* Download overlay */}
                          {item.signed_url && (
                            <a
                              href={item.signed_url}
                              download={item.filename}
                              target="_blank"
                              rel="noreferrer"
                              className="absolute inset-0 flex items-end justify-end p-2 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <span className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium text-white">
                                Descargar
                              </span>
                            </a>
                          )}
                        </div>
                      ) : item.mime_type.startsWith('video/') ? (
                        <div className="overflow-hidden rounded-lg bg-brand-navy/5">
                          {item.signed_url ? (
                            <video
                              src={item.signed_url}
                              controls
                              preload="none"
                              className="w-full rounded-lg"
                            />
                          ) : (
                            <div className="flex aspect-video items-center justify-center text-xs text-gray-400">
                              No disponible
                            </div>
                          )}
                          {item.signed_url && (
                            <div className="flex items-center justify-between px-1 py-1.5">
                              <p className="truncate text-xs text-gray-500">{item.caption ?? item.filename}</p>
                              <a
                                href={item.signed_url}
                                download={item.filename}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 rounded-md border border-brand-stone px-2 py-0.5 text-[10px] font-medium text-brand-navy hover:bg-brand-canvas"
                              >
                                Descargar
                              </a>
                            </div>
                          )}
                        </div>
                      ) : null}
                      {item.caption && item.mime_type.startsWith('image/') && (
                        <p className="mt-1 truncate text-[11px] text-gray-500">{item.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </PortalShell>
  )
}
