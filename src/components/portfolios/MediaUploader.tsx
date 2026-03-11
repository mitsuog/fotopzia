'use client'
import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MediaUploaderProps {
  contactId: string
  albumId: string
  onUploadComplete?: () => void
}

export function MediaUploader({ contactId, albumId, onUploadComplete }: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploads, setUploads] = useState<Array<{ name: string; status: 'uploading' | 'done' | 'error'; progress: number }>>([])

  const uploadFile = useCallback(async (file: File) => {
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
    const path = `${contactId}/${albumId}/${filename}`

    setUploads(prev => [...prev, { name: file.name, status: 'uploading', progress: 0 }])

    const { error: uploadError } = await supabase.storage
      .from('media-private')
      .upload(path, file)

    if (uploadError) {
      setUploads(prev => prev.map(u => u.name === file.name ? { ...u, status: 'error' } : u))
      return
    }

    await supabase.from('media_items').insert({
      album_id: albumId,
      storage_path: path,
      filename: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
    })

    setUploads(prev => prev.map(u => u.name === file.name ? { ...u, status: 'done', progress: 100 } : u))
    onUploadComplete?.()
  }, [contactId, albumId, onUploadComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.type.startsWith('image/') || f.type.startsWith('video/')
    )
    files.forEach(uploadFile)
  }, [uploadFile])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach(uploadFile)
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
          isDragging ? 'border-brand-gold bg-brand-gold/5' : 'border-brand-stone hover:border-brand-gold/50',
        )}
      >
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFileInput}
          className="hidden"
          id="media-upload"
        />
        <label htmlFor="media-upload" className="cursor-pointer">
          <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">Arrastra archivos aquí o haz clic para seleccionar</p>
          <p className="text-xs text-gray-400 mt-1">Imágenes y videos (JPG, PNG, MP4, MOV)</p>
        </label>
      </div>

      {uploads.length > 0 && (
        <div className="mt-3 space-y-2">
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {u.status === 'done' ? (
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : u.status === 'error' ? (
                <X className="w-4 h-4 text-red-500 shrink-0" />
              ) : (
                <div className="w-4 h-4 border-2 border-brand-gold border-t-transparent rounded-full animate-spin shrink-0" />
              )}
              <span className="truncate text-gray-600">{u.name}</span>
              <span className="text-xs text-gray-400 ml-auto">
                {u.status === 'done' ? 'Listo' : u.status === 'error' ? 'Error' : 'Subiendo...'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
