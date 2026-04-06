'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useContacts } from '@/hooks/useContacts'
import { NewContactSheet } from './NewContactSheet'
import { Search, UserPlus, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Contact } from '@/types/crm'

interface ContactsTableProps {
  initialContacts: Contact[]
}

export function ContactsTable({ initialContacts }: ContactsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: contacts = initialContacts } = useContacts()
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [isNewContactOpenManually, setIsNewContactOpenManually] = useState(false)
  const openFromQuery = searchParams.get('newContact') === '1'
  const isNewContactOpen = isNewContactOpenManually || openFromQuery

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const value = search.trim()
    if (value) params.set('q', value)
    else params.delete('q')

    const next = params.toString()
    const current = searchParams.toString()
    if (next !== current) {
      router.replace(next ? `/crm/list?${next}` : '/crm/list', { scroll: false })
    }
  }, [router, search, searchParams])

  const filtered = useMemo(() => {
    if (!search) return contacts
    const q = search.toLowerCase()
    return contacts.filter(c =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.company_name ?? '').toLowerCase().includes(q)
    )
  }, [contacts, search])

  function handleCloseNewContact() {
    setIsNewContactOpenManually(false)
    if (openFromQuery) {
      router.replace('/crm/list', { scroll: false })
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar contacto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-brand-stone rounded-lg bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
          />
        </div>
        <button
          onClick={() => setIsNewContactOpenManually(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-sm text-white transition-colors hover:bg-brand-navy-light sm:w-auto"
        >
          <UserPlus className="w-4 h-4" />
          Nuevo Contacto
        </button>
      </div>

      {/* Mobile: card list */}
      <div className="block sm:hidden space-y-2">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">
            {search ? 'Sin resultados para la búsqueda' : 'Sin contactos registrados'}
          </p>
        ) : (
          filtered.map(contact => (
            <button
              key={contact.id}
              type="button"
              onClick={() => router.push(`/crm/${contact.id}`)}
              className="w-full text-left flex items-center gap-3 rounded-xl border border-brand-stone bg-white p-3 shadow-sm"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-navy text-sm font-bold text-white">
                {contact.first_name[0]}{contact.last_name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-brand-navy truncate">{contact.first_name} {contact.last_name}</p>
                <p className="text-xs text-gray-500 truncate">{contact.company_name ?? contact.email ?? ''}</p>
              </div>
              {contact.tags && contact.tags.length > 0 && (
                <span className="shrink-0 rounded-full bg-brand-canvas border border-brand-stone px-2 py-0.5 text-[10px] text-gray-600">
                  {contact.tags[0]}{contact.tags.length > 1 ? ` +${contact.tags.length - 1}` : ''}
                </span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Desktop: Table */}
      <div className="hidden sm:block bg-white border border-brand-stone rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-brand-canvas border-b border-brand-stone">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Empresa</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fuente</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Etiquetas</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Creado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-sm text-gray-400">
                  {search ? 'Sin resultados para la búsqueda' : 'Sin contactos registrados'}
                </td>
              </tr>
            ) : (
              filtered.map(contact => (
                <tr
                  key={contact.id}
                  onClick={() => router.push(`/crm/${contact.id}`)}
                  className="border-b border-brand-stone/50 last:border-0 hover:bg-brand-canvas/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-brand-navy">
                      {contact.first_name} {contact.last_name}
                    </p>
                    {contact.phone && (
                      <p className="text-xs text-gray-400 mt-0.5">{contact.phone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {contact.company_name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {contact.email ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {contact.source ? (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {contact.source}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags && contact.tags.length > 0 ? (
                        contact.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[10px] bg-brand-canvas border border-brand-stone text-gray-600 px-1.5 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                      {contact.tags && contact.tags.length > 3 && (
                        <span className="text-[10px] text-gray-400">+{contact.tags.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {format(new Date(contact.created_at), 'd MMM yyyy', { locale: es })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/crm/${contact.id}`) }}
                      className="flex items-center gap-1 text-xs text-brand-navy hover:text-brand-gold transition-colors"
                    >
                      Ver
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          </table>
        </div>
      </div>

      <NewContactSheet
        open={isNewContactOpen}
        onClose={handleCloseNewContact}
      />
    </div>
  )
}
