'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'

const PROJECT_TYPES = [
  { value: 'contract', label: 'Contrato', desc: 'Proyecto originado de un deal/contrato firmado' },
  { value: 'internal', label: 'Interno', desc: 'Proyecto interno del estudio sin cliente externo' },
  { value: 'alliance', label: 'Alianza', desc: 'Proyecto en colaboración con otra empresa' },
] as const

const STAGE_OPTIONS = [
  { value: 'preproduccion',    label: 'Pre-producción' },
  { value: 'primera_revision', label: '1ª Revisión' },
  { value: 'produccion',       label: 'Producción' },
  { value: 'segunda_revision', label: '2ª Revisión' },
  { value: 'entrega',          label: 'Entrega' },
  { value: 'cierre',           label: 'Cierre' },
] as const

const COLOR_OPTIONS = [
  '#1C2B4A', '#C49A2A', '#0f766e', '#7c3aed', '#b45309', '#0369a1', '#be185d',
]

export default function NewProjectPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    title: '',
    project_type: 'internal' as 'contract' | 'internal' | 'alliance',
    description: '',
    start_date: '',
    due_date: '',
    color: COLOR_OPTIONS[0],
    stage: 'preproduccion' as string,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          project_type: form.project_type,
          stage: form.stage,
          description: form.description || null,
          start_date: form.start_date || null,
          due_date: form.due_date || null,
          color: form.color,
          contact_id: null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? json.error ?? 'Error al crear proyecto')
      router.push(`/projects/${json.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear proyecto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-brand-navy transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Proyectos
        </Link>
      </div>

      <PageHeader title="Nuevo Proyecto" subtitle="Crea un proyecto interno, alianza o iniciativa sin contrato" badge="Studio Ops" />

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-brand-stone/80 bg-white/85 p-6 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)]">
        {/* Type */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-brand-navy">Tipo de proyecto</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PROJECT_TYPES.map(type => (
              <button
                key={type.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, project_type: type.value }))}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  form.project_type === type.value
                    ? 'border-brand-navy bg-brand-navy/5'
                    : 'border-brand-stone hover:border-brand-navy/50'
                }`}
              >
                <p className="text-sm font-semibold text-brand-navy">{type.label}</p>
                <p className="mt-0.5 text-xs text-gray-500">{type.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-navy">Nombre del proyecto *</label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
            placeholder="Ej: Campaña verano 2026..."
            className="w-full rounded-lg border border-brand-stone px-3 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-gold"
          />
        </div>

        {/* Stage */}
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-navy">Etapa inicial</label>
          <select
            value={form.stage}
            onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
            className="w-full rounded-lg border border-brand-stone px-3 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-gold"
          >
            {STAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-navy">Fecha de inicio</label>
            <input
              type="date"
              value={form.start_date}
              onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              className="w-full rounded-lg border border-brand-stone px-3 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-navy">Fecha de entrega</label>
            <input
              type="date"
              value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className="w-full rounded-lg border border-brand-stone px-3 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-gold"
            />
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="mb-2 block text-sm font-medium text-brand-navy">Color en portfolio</label>
          <div className="flex gap-2">
            {COLOR_OPTIONS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setForm(f => ({ ...f, color }))}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${
                  form.color === color ? 'scale-110 border-brand-navy' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-navy">Descripción</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            placeholder="Contexto, objetivo, alcance..."
            className="w-full resize-none rounded-lg border border-brand-stone px-3 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-gold"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <Link
            href="/projects"
            className="rounded-lg border border-brand-stone px-5 py-2.5 text-sm text-brand-navy"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving || !form.title.trim()}
            className="rounded-lg bg-brand-navy px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-brand-navy-light"
          >
            {saving ? 'Creando...' : 'Crear proyecto'}
          </button>
        </div>
      </form>
    </div>
  )
}
