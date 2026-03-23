export interface PaginatedContractPage {
  pageNumber: number
  lines: string[]
}

function lineWeight(line: string): number {
  const trimmed = line.trim()
  if (!trimmed) return 0.35
  if (/^[IVXLCDM]+\./i.test(trimmed) || /^CONTRATO DE PRESTACI/i.test(trimmed)) return 1.3
  if (/^\d+\./.test(trimmed)) return 1.05
  if (/^(Firmas|EL PRESTADOR|EL CLIENTE)$/i.test(trimmed)) return 1.15
  if (trimmed.length > 180) return 1.2
  if (trimmed.length > 120) return 1.05
  return 0.85
}

export function paginateContractBody(body: string, pageCountInput: number): PaginatedContractPage[] {
  const pageCount = Math.max(1, Number.isFinite(pageCountInput) ? Math.floor(pageCountInput) : 1)
  const sourceLines = body.split('\n')
  const lines = sourceLines.length > 0 ? sourceLines : ['']

  if (pageCount === 1) {
    return [{ pageNumber: 1, lines }]
  }

  const weights = lines.map(lineWeight)
  const totalWeight = weights.reduce((sum, value) => sum + value, 0)
  const targetWeight = totalWeight / pageCount

  const pages: PaginatedContractPage[] = []
  let start = 0

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const remainingPages = pageCount - pageIndex
    const remainingLines = lines.length - start

    if (remainingPages <= 1 || remainingLines <= 1) {
      pages.push({
        pageNumber: pageIndex + 1,
        lines: lines.slice(start),
      })
      start = lines.length
      break
    }

    const maxEndExclusive = lines.length - (remainingPages - 1)
    let end = start
    let currentWeight = 0

    while (end < maxEndExclusive) {
      currentWeight += weights[end]
      end += 1

      if (end > start && currentWeight >= targetWeight) {
        break
      }
    }

    if (end <= start) end = start + 1

    pages.push({
      pageNumber: pageIndex + 1,
      lines: lines.slice(start, end),
    })
    start = end
  }

  while (pages.length < pageCount) {
    pages.push({ pageNumber: pages.length + 1, lines: [''] })
  }

  if (pages.length > pageCount) {
    const extra = pages.splice(pageCount)
    const lastPage = pages[pages.length - 1]
    for (const page of extra) {
      lastPage.lines.push(...page.lines)
    }
  }

  return pages.map((page, index) => ({ ...page, pageNumber: index + 1 }))
}