'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage('Revisa tu email — te enviamos un enlace de recuperación.')
    }
    setLoading(false)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">

      {/* Panel izquierdo — imagen */}
      <div className="relative hidden lg:flex lg:w-[60%] xl:w-[65%]">
        <Image
          src="/portadalogin.jpeg"
          alt="Fotopzia"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10">
          <p className="text-white/50 text-xs tracking-[0.2em] uppercase mb-2">Tail OS x Fotopzia</p>
          <p className="text-white text-2xl font-light leading-snug">
            Capturamos momentos.<br />
            <span className="font-semibold">Gestionamos historias.</span>
          </p>
        </div>
      </div>

      {/* Panel derecho */}
      <div className="flex flex-col w-full lg:w-[40%] xl:w-[35%] bg-brand-paper">

        <div className="flex items-center justify-center pt-10 pb-2">
          <Image
            src="/logo_fotopzia.jpg"
            alt="Fotopzia"
            width={200}
            height={100}
            className="object-contain"
            style={{ mixBlendMode: 'multiply' }}
            priority
          />
        </div>

        <div className="flex flex-col flex-1 items-center justify-center px-8 sm:px-12 xl:px-16 -mt-10">
          <div className="w-full max-w-sm">

            <a href="/login" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-navy transition-colors mb-6">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Volver al login
            </a>

            <h1 className="text-[1.6rem] font-semibold text-brand-navy mb-1 tracking-tight">
              Recuperar contraseña
            </h1>
            <p className="text-sm text-gray-400 mb-8">
              Ingresa tu correo y te enviamos un enlace para restablecer tu contraseña.
            </p>

            <form onSubmit={handleReset} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-brand-navy/70 tracking-wide uppercase">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="nombre@fotopzia.com"
                  className="
                    w-full px-4 py-3 rounded-lg text-sm
                    bg-white border border-brand-stone
                    text-brand-navy placeholder:text-gray-300
                    outline-none transition-all duration-200
                    focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20
                    hover:border-brand-gold/50
                  "
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-50 border border-red-100">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              {message && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-green-50 border border-green-100">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-green-700">{message}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="
                  w-full py-3 rounded-lg text-sm font-semibold
                  bg-brand-navy text-white
                  transition-all duration-200
                  hover:bg-brand-navy-light active:scale-[0.99]
                  disabled:opacity-60 disabled:cursor-not-allowed
                  focus:outline-none focus:ring-2 focus:ring-brand-gold/50
                "
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Enviando…
                  </span>
                ) : 'Enviar enlace'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-300 pb-6">
          © {new Date().getFullYear()} Fotopzia · Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}
