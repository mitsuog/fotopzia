import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPortalAccessByToken, touchPortalAccess } from '@/lib/portal/token'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const { access, error } = await getPortalAccessByToken(token)

  if (error || !access) {
    return NextResponse.json({ error: error ?? 'Portal no disponible.' }, { status: 404 })
  }

  await touchPortalAccess(access)

  // Gate: debe haber al menos un contrato firmado
  const { count: signedContracts } = await supabaseAdmin
    .from('contracts')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', access.contact_id)
    .eq('status', 'signed')

  if (!signedContracts || signedContracts === 0) {
    return NextResponse.json({ data: { gallery_locked: true, albums: [] } })
  }

  // Traer albums publicados
  const { data: albums, error: albumsError } = await supabaseAdmin
    .from('albums')
    .select('id, title, description, cover_url, sort_order')
    .eq('contact_id', access.contact_id)
    .eq('is_published', true)
    .order('sort_order', { ascending: true })

  if (albumsError) {
    return NextResponse.json({ error: albumsError.message }, { status: 400 })
  }

  // Por cada album, traer media_items y generar signed URLs
  const albumsWithMedia = await Promise.all(
    (albums ?? []).map(async album => {
      const { data: items } = await supabaseAdmin
        .from('media_items')
        .select('id, filename, mime_type, width, height, duration_secs, caption, is_favorite, sort_order, storage_path')
        .eq('album_id', album.id)
        .order('sort_order', { ascending: true })

      const media = await Promise.all(
        (items ?? []).map(async item => {
          const { data: signedData } = await supabaseAdmin.storage
            .from('media-private')
            .createSignedUrl(item.storage_path, 3600)
          return {
            id: item.id,
            filename: item.filename,
            mime_type: item.mime_type,
            width: item.width,
            height: item.height,
            duration_secs: item.duration_secs,
            caption: item.caption,
            is_favorite: item.is_favorite,
            sort_order: item.sort_order,
            signed_url: signedData?.signedUrl ?? null,
          }
        }),
      )

      // Cover: si es un storage path (no URL absoluta), generar signed URL
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

  return NextResponse.json({ data: { gallery_locked: false, albums: albumsWithMedia } })
}
