'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Images } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Album {
  id: string
  title: string
  description: string | null
  cover_url: string | null
  contact_id: string
  is_published: boolean
  created_at: string
}

interface AlbumGridProps {
  albums: Album[]
  contactId: string
}

export function AlbumGrid({ albums, contactId }: AlbumGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {albums.map(album => (
        <Link
          key={album.id}
          href={`/portfolios/${contactId}/${album.id}`}
          className="group block rounded-xl overflow-hidden border border-brand-stone hover:border-brand-gold transition-colors bg-brand-paper"
        >
          <div className="relative aspect-square bg-brand-canvas flex items-center justify-center overflow-hidden">
              {album.cover_url ? (
                <Image
                  src={album.cover_url}
                  alt={album.title}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <Images className="w-10 h-10 text-gray-300" />
              )}
          </div>
          <div className="p-3">
            <p className="font-medium text-brand-navy text-sm truncate">{album.title}</p>
            {album.description && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{album.description}</p>
            )}
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full mt-1 inline-block',
              album.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
            )}>
              {album.is_published ? 'Publicado' : 'Borrador'}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
