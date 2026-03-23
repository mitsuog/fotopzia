import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildContractDraftData, type ContractDraftPayload } from '@/lib/contracts/build-contract-draft'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'project_manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payload = (await request.json().catch(() => null)) as ContractDraftPayload | null
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 })
  }

  try {
    const draft = await buildContractDraftData(supabase, payload)

    const annexes = draft.annexTemplates.map((template, index) => ({
      id: `${template.key}-${index + 1}`,
      title: template.title,
      template_key: template.key,
      requires_signature: template.requires_signature,
      body: template.body,
    }))

    return NextResponse.json({
      data: {
        title: draft.title,
        contract_body: draft.body,
        annexes,
        include_quote_document: draft.includeQuoteDocument,
        quote_number: draft.latestApprovedQuote.quote_number,
        computed_page_count: draft.computedPageCount,
        required_initials: draft.computedPageCount > 1 ? draft.computedPageCount : 0,
      },
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'No fue posible generar previsualizacion.',
    }, { status: 400 })
  }
}
