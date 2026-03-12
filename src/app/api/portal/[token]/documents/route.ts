import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPortalAccessByToken, touchPortalAccess } from '@/lib/portal/token'
import type { ContractAnnex } from '@/types/quotes'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const { access, error } = await getPortalAccessByToken(token)

  if (error || !access) {
    return NextResponse.json({ error: error ?? 'Portal no disponible.' }, { status: 404 })
  }

  await touchPortalAccess(access)

  const [quotesResult, contractsResult] = await Promise.all([
    supabaseAdmin
      .from('quotes')
      .select('id, quote_number, title, status, total, currency, sent_at, viewed_at, approved_at, approved_by, updated_at')
      .eq('contact_id', access.contact_id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('contracts')
      .select('id, contract_number, title, status, sent_at, viewed_at, signed_at, signed_by, page_count, annexes, updated_at')
      .eq('contact_id', access.contact_id)
      .order('created_at', { ascending: false }),
  ])

  if (quotesResult.error) {
    return NextResponse.json({ error: quotesResult.error.message }, { status: 400 })
  }
  if (contractsResult.error) {
    return NextResponse.json({ error: contractsResult.error.message }, { status: 400 })
  }

  const quotes = (quotesResult.data ?? []).map(quote => ({
    ...quote,
    signable: quote.status === 'sent' || quote.status === 'viewed',
  }))

  const contracts = (contractsResult.data ?? []).map(contract => {
    const annexes = Array.isArray(contract.annexes) ? (contract.annexes as unknown as ContractAnnex[]) : []
    const pendingAnnexes = annexes.filter(annex => annex.requires_signature && !annex.signed_at)
    return {
      ...contract,
      annexes,
      pending_annexes: pendingAnnexes.length,
      signable: contract.status === 'sent' || contract.status === 'viewed',
    }
  })

  return NextResponse.json({
    data: {
      contact: access.contacts,
      quotes,
      contracts,
    },
  })
}
