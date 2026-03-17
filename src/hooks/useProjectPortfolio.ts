'use client'

import { useState, useEffect } from 'react'
import type { PortfolioProjectSummary } from '@/types/wbs'

export function useProjectPortfolio() {
  const [projects, setProjects] = useState<PortfolioProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/projects/portfolio')
      .then(r => r.json())
      .then(json => {
        if (!cancelled) {
          setProjects(json.data ?? [])
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar portfolio')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  return { projects, loading, error }
}
