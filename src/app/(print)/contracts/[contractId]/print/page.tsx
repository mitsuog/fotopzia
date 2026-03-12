import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseContractContent, toContractAnnexes } from '@/lib/documents/contracts'
import { PrintToolbar } from './PrintToolbar'

export const dynamic = 'force-dynamic'

interface ContractPrintPageProps {
  params: Promise<{ contractId: string }>
}

export default async function ContractPrintPage({ params }: ContractPrintPageProps) {
  const { contractId } = await params
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, contract_number, title, status, content, signed_by, signed_at, signed_signature_data, initials_data, page_count, annexes, contact:contacts(first_name, last_name, email, phone, company_name), quote:quotes(quote_number, title)')
    .eq('id', contractId)
    .single()

  if (!contract) notFound()

  const parsed = parseContractContent(contract.content, toContractAnnexes(contract.annexes))
  const initials = Array.isArray(contract.initials_data) ? contract.initials_data.map(value => String(value)) : []

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @page { size: A4; margin: 1.8cm 2cm 2.2cm 2cm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .page-wrap { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
        }
        @media screen {
          body { background: #edecea; }
          .page-wrap {
            max-width: 800px; margin: 0 auto; background: white;
            box-shadow: 0 6px 32px rgba(0,0,0,0.18); border-radius: 4px; min-height: 1122px;
          }
        }
        body {
          font-family: 'Montserrat', 'Segoe UI', Arial, sans-serif;
          font-size: 11px; color: #1a1a2e; line-height: 1.5;
        }
        .toolbar {
          background: #1C2B4A; padding: 12px 24px; display: flex; align-items: center;
          justify-content: space-between; gap: 12px; border-radius: 4px 4px 0 0;
        }
        .toolbar span { color: rgba(255,255,255,0.7); font-size: 11px; }
        .btn-print, .btn-close {
          display: inline-flex; align-items: center; border: none; cursor: pointer;
          padding: 8px 14px; border-radius: 6px; font-size: 12px; font-family: inherit;
        }
        .btn-print { background: #C49A2A; color: white; font-weight: 600; }
        .btn-close { background: transparent; color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.2); }
        .page-content { padding: 48px 52px 56px; }
        .doc-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding-bottom: 24px; border-bottom: 2px solid #1C2B4A; margin-bottom: 24px;
        }
        .studio-logo { width: 220px; height: auto; display: block; margin-bottom: 8px; }
        .quote-title-badge {
          display: inline-block; background: #1C2B4A; color: white; font-size: 13px; font-weight: 700;
          letter-spacing: 2px; padding: 6px 14px; border-radius: 4px; margin-bottom: 8px;
        }
        .meta { font-size: 10px; color: #555; margin-top: 2px; }
        .section-title { margin-top: 16px; margin-bottom: 6px; color: #1C2B4A; font-weight: 700; font-size: 12px; }
        .paragraph { margin-bottom: 8px; text-align: justify; }
        .panel { border: 1px solid #e5e3dd; border-radius: 6px; padding: 10px; margin-top: 14px; background: #faf9f7; }
        .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 20px; }
        .sign-box { border-top: 1px solid #cbd5e1; padding-top: 8px; min-height: 70px; }
        .signature-img { max-height: 64px; max-width: 100%; object-fit: contain; }
        .initials-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
        .initial-badge { border: 1px solid #d0d7e2; border-radius: 4px; padding: 2px 6px; font-size: 9px; color: #475569; background: #fff; }
      `}</style>

      <div className="page-wrap">
        <PrintToolbar contractNumber={contract.contract_number} />

        <div className="page-content">
          <header className="doc-header">
            <div>
              <img src="/logo_fotopzia.png" alt="Fotopzia" className="studio-logo" />
              <p className="meta">Fotopzia Mexico · Veracruz, Ver.</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="quote-title-badge">CONTRATO</span>
              <p className="meta">No. {contract.contract_number}</p>
              <p className="meta">Estado: {contract.status}</p>
            </div>
          </header>

          <section>
            <h1 style={{ fontSize: '18px', color: '#1C2B4A', marginBottom: '8px' }}>{contract.title}</h1>
            <p className="meta">
              Cliente: {contract.contact ? `${contract.contact.first_name} ${contract.contact.last_name}` : 'No disponible'}
            </p>
            {contract.contact?.company_name && <p className="meta">Empresa: {contract.contact.company_name}</p>}
            {contract.quote && <p className="meta">Cotización relacionada: {contract.quote.quote_number} · {contract.quote.title}</p>}
          </section>

          <section style={{ marginTop: '14px' }}>
            {parsed.body.split('\n').map((line, index) => {
              const trimmed = line.trim()
              if (!trimmed) return <p key={`empty-${index}`} className="paragraph">&nbsp;</p>
              const isTitle = /^[IVXLCDM]+\./i.test(trimmed) || /^CONTRATO/i.test(trimmed)
              return (
                <p key={`line-${index}`} className={isTitle ? 'section-title' : 'paragraph'}>
                  {trimmed}
                </p>
              )
            })}
          </section>

          <section className="panel">
            <p className="section-title" style={{ marginTop: 0 }}>Anexos</p>
            {parsed.annexes.length === 0 && <p className="paragraph">Sin anexos.</p>}
            {parsed.annexes.map((annex, index) => (
              <p key={annex.id} className="paragraph">
                {index + 1}. {annex.title} · {annex.signed_at ? `Firmado por ${annex.signed_by ?? 'cliente'}` : 'Pendiente de firma'}
              </p>
            ))}
          </section>

          <section className="panel">
            <p className="section-title" style={{ marginTop: 0 }}>Antefirma por página (requisito)</p>
            <p className="paragraph">Páginas requeridas: {contract.page_count ?? 1}</p>
            <div className="initials-row">
              {initials.length === 0 && <span className="initial-badge">Pendiente</span>}
              {initials.map((initial, index) => (
                <span key={`initial-${index + 1}`} className="initial-badge">
                  Página {index + 1}
                  {initial.startsWith('data:image/') ? ': Registrada' : `: ${initial}`}
                </span>
              ))}
            </div>
          </section>

          <section className="signature-grid">
            <div className="sign-box">
              <p style={{ fontSize: '10px', color: '#64748b' }}>Firma del cliente</p>
              {contract.signed_signature_data ? (
                <img src={contract.signed_signature_data} alt="Firma cliente" className="signature-img" />
              ) : (
                <p className="meta">Pendiente</p>
              )}
              <p className="meta">Nombre: {contract.signed_by ?? 'Pendiente'}</p>
              <p className="meta">Fecha: {contract.signed_at ? new Date(contract.signed_at).toLocaleString('es-MX') : 'Pendiente'}</p>
            </div>
            <div className="sign-box">
              <p style={{ fontSize: '10px', color: '#64748b' }}>Fotopzia Mexico</p>
              <p className="meta">Representante autorizado</p>
              <p className="meta">Firma interna</p>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
