import { NextResponse } from 'next/server'
import type { WeatherData, WeatherDay } from '@/types/wbs'

export const revalidate = 1800 // 30 minutes

// Veracruz, Ver. — Open-Meteo (no API key required)
const LAT = 19.18
const LON = -96.13
const TZ = 'America/Mexico_City'

const WMO_ICON: Record<number, string> = {
  0: '01', 1: '01',
  2: '02', 3: '04',
  45: '50', 48: '50',
  51: '09', 53: '09', 55: '09', 56: '09', 57: '09',
  61: '10', 63: '10', 65: '10', 66: '10', 67: '10',
  71: '13', 73: '13', 75: '13', 77: '13',
  80: '10', 81: '10', 82: '10',
  85: '13', 86: '13',
  95: '11', 96: '11', 99: '11',
}

const WMO_DESC: Record<number, string> = {
  0: 'Cielo despejado', 1: 'Mayormente despejado',
  2: 'Parcialmente nublado', 3: 'Nublado',
  45: 'Niebla', 48: 'Niebla con escarcha',
  51: 'Llovizna ligera', 53: 'Llovizna moderada', 55: 'Llovizna intensa',
  56: 'Llovizna congelante ligera', 57: 'Llovizna congelante intensa',
  61: 'Lluvia ligera', 63: 'Lluvia moderada', 65: 'Lluvia intensa',
  66: 'Lluvia congelante ligera', 67: 'Lluvia congelante intensa',
  71: 'Nieve ligera', 73: 'Nieve moderada', 75: 'Nieve intensa', 77: 'Granizo pequeño',
  80: 'Chubascos ligeros', 81: 'Chubascos moderados', 82: 'Chubascos intensos',
  85: 'Nevadas ligeras', 86: 'Nevadas intensas',
  95: 'Tormenta eléctrica', 96: 'Tormenta con granizo', 99: 'Tormenta intensa con granizo',
}

function wmoIcon(code: number): string {
  return (WMO_ICON[code] ?? '01') + 'd'
}

function wmoDesc(code: number): string {
  return WMO_DESC[code] ?? 'Condición desconocida'
}

interface OMResponse {
  current: {
    temperature_2m: number
    relative_humidity_2m: number
    apparent_temperature: number
    weather_code: number
    wind_speed_10m: number
    wind_direction_10m: number
    precipitation: number
    cloud_cover: number
  }
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: number[]
    precipitation_probability_max: number[]
  }
}

export async function GET() {
  try {
    const params = new URLSearchParams({
      latitude: String(LAT),
      longitude: String(LON),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,precipitation,cloud_cover',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
      timezone: TZ,
      forecast_days: '6',
      wind_speed_unit: 'ms',
    })

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      next: { revalidate: 1800 },
    })

    if (!res.ok) {
      return NextResponse.json({ data: null, error: `Open-Meteo error: ${res.status}` })
    }

    const raw: OMResponse = await res.json()
    const c = raw.current
    const d = raw.daily

    const forecast: WeatherDay[] = d.time.slice(0, 5).map((date, i) => ({
      date,
      temp_min: Math.round(d.temperature_2m_min[i]),
      temp_max: Math.round(d.temperature_2m_max[i]),
      description: wmoDesc(d.weather_code[i]),
      icon: wmoIcon(d.weather_code[i]),
      pop: (d.precipitation_probability_max[i] ?? 0) / 100,
    }))

    const weatherData: WeatherData = {
      city: 'Veracruz',
      updated_at: new Date().toISOString(),
      current: {
        temp: Math.round(c.temperature_2m),
        feels_like: Math.round(c.apparent_temperature),
        description: wmoDesc(c.weather_code),
        icon: wmoIcon(c.weather_code),
        humidity: c.relative_humidity_2m,
        wind_speed: Math.round(c.wind_speed_10m * 10) / 10,
        wind_deg: c.wind_direction_10m,
        rain_1h: c.precipitation > 0 ? c.precipitation : undefined,
        clouds: c.cloud_cover,
      },
      forecast,
    }

    return NextResponse.json({ data: weatherData })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ data: null, error: msg })
  }
}
