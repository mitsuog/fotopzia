'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ProfileFormProps {
  profile: {
    id: string
    full_name: string
    email: string
    role: string
    phone: string | null
    timezone: string
    avatar_url: string | null
    is_active: boolean
  }
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter()
  const [fullName, setFullName] = useState(profile.full_name)
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [timezone, setTimezone] = useState(profile.timezone)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(profile.avatar_url ?? null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(avatarPreviewUrl)
    }
  }, [avatarPreviewUrl])

  function handleAvatarFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedMimeTypes.includes(file.type)) {
      setError('Formato no permitido. Usa JPG, PNG o WEBP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen excede 5MB.')
      return
    }

    if (avatarPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(avatarPreviewUrl)
    setAvatarFile(file)
    setAvatarPreviewUrl(URL.createObjectURL(file))
    setError(null)
    setMessage(null)
  }

  function handleRemoveAvatar() {
    if (avatarPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(avatarPreviewUrl)
    setAvatarFile(null)
    setAvatarPreviewUrl(null)
    setAvatarUrl('')
    setMessage(null)
    setError(null)
  }

  function getFileExtension(file: File): string {
    if (file.type === 'image/jpeg') return 'jpg'
    if (file.type === 'image/png') return 'png'
    if (file.type === 'image/webp') return 'webp'
    return (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)

    const supabase = createClient()
    let nextAvatarUrl: string | null = avatarUrl.trim() || null

    if (avatarFile) {
      const ext = getFileExtension(avatarFile)
      const randomSuffix = Math.random().toString(36).slice(2, 10)
      const path = `${profile.id}/${Date.now()}-${randomSuffix}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, {
          contentType: avatarFile.type,
          upsert: false,
        })

      if (uploadError) {
        setError(uploadError.message)
        setSaving(false)
        return
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      nextAvatarUrl = data.publicUrl
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        timezone: timezone.trim() || 'America/Mexico_City',
        avatar_url: nextAvatarUrl,
      })
      .eq('id', profile.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setAvatarUrl(nextAvatarUrl ?? '')
    setAvatarFile(null)
    setAvatarPreviewUrl(nextAvatarUrl)
    setMessage('Perfil actualizado correctamente.')
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_10px_24px_-20px_rgba(28,43,74,0.45)]">
      <h2 className="text-base font-semibold text-brand-navy">Mi perfil</h2>
      <p className="mt-1 text-xs text-gray-500">Los cambios se guardan directamente en Supabase.</p>

      <form onSubmit={handleSave} className="mt-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Nombre completo *</span>
            <input
              value={fullName}
              onChange={event => setFullName(event.target.value)}
              required
              className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-gold/35"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Teléfono</span>
            <input
              value={phone}
              onChange={event => setPhone(event.target.value)}
              className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-gold/35"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Zona horaria</span>
            <input
              value={timezone}
              onChange={event => setTimezone(event.target.value)}
              className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-gold/35"
            />
          </label>

          <div className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Foto de perfil</span>
            <div className="rounded-lg border border-brand-stone bg-brand-paper px-3 py-2">
              <div className="flex items-center gap-3">
                {avatarPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreviewUrl}
                    alt="Avatar de perfil"
                    className="h-14 w-14 rounded-full object-cover ring-1 ring-brand-stone"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-navy text-sm font-semibold text-white">
                    {fullName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 space-y-2">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarFileChange}
                    className="block w-full text-xs text-gray-600 file:mr-2 file:rounded-md file:border file:border-brand-stone file:bg-white file:px-2 file:py-1 file:text-xs file:text-brand-navy hover:file:bg-brand-paper"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="rounded-md border border-brand-stone px-2 py-1 text-[11px] text-gray-600 hover:bg-white"
                    >
                      Quitar foto
                    </button>
                    <p className="text-[11px] text-gray-500">JPG, PNG o WEBP. Max 5MB.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-brand-stone bg-brand-paper px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Email</p>
            <p className="mt-1 text-sm text-brand-navy">{profile.email}</p>
          </div>
          <div className="rounded-lg border border-brand-stone bg-brand-paper px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Rol</p>
            <p className="mt-1 text-sm capitalize text-brand-navy">{profile.role}</p>
          </div>
          <div className="rounded-lg border border-brand-stone bg-brand-paper px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Estado</p>
            <p className="mt-1 text-sm text-brand-navy">{profile.is_active ? 'Activo' : 'Inactivo'}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-navy-light disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar perfil'}
        </button>
      </form>
    </div>
  )
}
