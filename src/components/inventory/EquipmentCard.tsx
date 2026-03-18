import Link from 'next/link'
import { MapPin } from 'lucide-react'
import type { EquipmentItem } from '@/types/inventory'
import { CONDITION_CONFIG, STATUS_CONFIG, LOCATION_LABELS } from '@/types/inventory'

interface Props {
  item: EquipmentItem
}

export function EquipmentCard({ item }: Props) {
  const condition = CONDITION_CONFIG[item.condition]
  const status = STATUS_CONFIG[item.status]

  return (
    <Link
      href={`/inventory/${item.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Asset tag badge */}
      <span className="absolute right-2 top-2 rounded bg-gray-800/80 px-1.5 py-0.5 font-mono text-[10px] text-white">
        {item.asset_tag}
      </span>

      {/* Photo or placeholder */}
      <div className="flex h-36 items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        {item.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photo_url}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-2xl text-gray-400">
            {item.category?.icon ?? '📦'}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <p className="line-clamp-1 text-sm font-semibold text-gray-800">{item.name}</p>
          {(item.brand || item.model) && (
            <p className="text-xs text-gray-400">{[item.brand, item.model].filter(Boolean).join(' · ')}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${condition.badge}`}>
            {condition.label}
          </span>
        </div>

        <div className="mt-auto flex items-center gap-1 text-xs text-gray-400">
          <MapPin className="h-3 w-3 shrink-0" />
          {LOCATION_LABELS[item.location]}
        </div>
      </div>
    </Link>
  )
}
