'use client'

import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, CloudDrizzle, Thermometer, MapPin } from 'lucide-react'
import type { WeatherData } from '@/types/wbs'

const DAY_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function WeatherIcon({ icon, className }: { icon: string; className?: string }) {
  const code = icon.slice(0, 2)
  const props = { className: className ?? 'h-5 w-5' }
  switch (code) {
    case '01': return <Sun {...props} />
    case '02': case '03': case '04': return <Cloud {...props} />
    case '09': return <CloudDrizzle {...props} />
    case '10': return <CloudRain {...props} />
    case '11': return <CloudLightning {...props} />
    case '13': return <CloudSnow {...props} />
    case '50': return <Wind {...props} />
    default: return <Sun {...props} />
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

interface WeatherWidgetProps {
  data: WeatherData | null
}

export function WeatherWidget({ data }: WeatherWidgetProps) {
  if (!data) {
    return (
      <article className="rounded-2xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur">
        <div className="flex items-center gap-2 text-brand-navy/50">
          <Cloud className="h-5 w-5" />
          <span className="text-xs font-medium">Veracruz, Ver.</span>
        </div>
        <p className="mt-3 text-2xl font-light text-brand-navy/30">--°</p>
        <p className="mt-1 text-xs text-gray-400">Sin conexión al servicio de clima</p>
      </article>
    )
  }

  const { current, forecast, city } = data
  const popPct = Math.round((current.clouds ?? 0))

  return (
    <article className="rounded-2xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1 text-brand-navy/60">
            <MapPin className="h-3.5 w-3.5" />
            <p className="text-xs font-semibold uppercase tracking-[0.12em]">{city}, Ver.</p>
          </div>
          <div className="mt-1 flex items-end gap-2">
            <p className="text-4xl font-light text-brand-navy">{current.temp}°</p>
            <div className="mb-1 text-xs text-gray-500">
              <p>ST {current.feels_like}°</p>
            </div>
          </div>
          <p className="text-xs text-gray-600">{capitalize(current.description)}</p>
        </div>
        <WeatherIcon icon={current.icon} className="h-10 w-10 text-brand-navy/70" />
      </div>

      {/* Current metrics */}
      <div className="mt-3 flex items-center gap-3 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <Droplets className="h-3.5 w-3.5 text-blue-400" />
          {current.humidity}%
        </span>
        <span className="flex items-center gap-1">
          <Wind className="h-3.5 w-3.5 text-gray-400" />
          {current.wind_speed} m/s
        </span>
        {current.rain_1h !== undefined && current.rain_1h > 0 && (
          <span className="flex items-center gap-1">
            <CloudRain className="h-3.5 w-3.5 text-blue-400" />
            {current.rain_1h} mm
          </span>
        )}
      </div>

      {/* 5-day forecast */}
      <div className="mt-4 flex gap-1">
        {forecast.map(day => {
          const d = new Date(day.date + 'T12:00:00')
          const dayLabel = DAY_ES[d.getDay()]
          const popHigh = day.pop >= 0.4

          return (
            <div
              key={day.date}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-lg border border-brand-stone/50 bg-brand-canvas/40 py-2"
            >
              <p className="text-[10px] font-medium text-brand-navy/70">{dayLabel}</p>
              <WeatherIcon icon={day.icon} className={`h-4 w-4 ${popHigh ? 'text-blue-500' : 'text-brand-navy/60'}`} />
              <p className="text-xs font-semibold text-brand-navy">{day.temp_max}°</p>
              <p className="text-[10px] text-gray-400">{day.temp_min}°</p>
              {day.pop > 0 && (
                <span className={`rounded-full px-1 text-[9px] font-medium ${popHigh ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                  {Math.round(day.pop * 100)}%
                </span>
              )}
            </div>
          )
        })}
      </div>
    </article>
  )
}
