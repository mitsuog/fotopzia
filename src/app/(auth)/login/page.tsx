'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">

      {/* ── Panel izquierdo — imagen de portada ── */}
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
          <p className="text-white/50 text-xs tracking-[0.2em] uppercase mb-2">
            Tail OS x Fotopzia
          </p>
          <p className="text-white text-2xl font-light leading-snug">
            Capturamos momentos.<br />
            <span className="font-semibold">Gestionamos historias.</span>
          </p>
        </div>
      </div>

      {/* ── Panel derecho — formulario ── */}
      <div className="flex flex-col w-full lg:w-[40%] xl:w-[35%] bg-brand-paper">

        {/* Logo */}
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

        {/* Formulario */}
        <div className="flex flex-col flex-1 items-center justify-center px-8 sm:px-12 xl:px-16 -mt-10">
          <div className="w-full max-w-sm">

            <h1 className="text-[1.6rem] font-semibold text-brand-navy mb-1 tracking-tight">
              Iniciar sesión
            </h1>
            <p className="text-sm text-gray-400 mb-8">
              Accede a tu cuenta de Fotopzia
            </p>

            <form onSubmit={handleLogin} className="space-y-5">

              {/* Email */}
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

              {/* Contraseña */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-brand-navy/70 tracking-wide uppercase">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••"
                    className="
                      w-full px-4 py-3 pr-11 rounded-lg text-sm
                      bg-white border border-brand-stone
                      text-brand-navy placeholder:text-gray-300
                      outline-none transition-all duration-200
                      focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20
                      hover:border-brand-gold/50
                    "
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-navy transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-50 border border-red-100">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-red-600 leading-relaxed">{error}</p>
                </div>
              )}

              {/* Botón */}
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
                    Iniciando sesión…
                  </span>
                ) : 'Iniciar sesión'}
              </button>

            </form>

            {/* Forgot password */}
            <p className="text-center mt-6 text-sm">
              <a
                href="/forgot-password"
                className="text-brand-gold hover:text-brand-gold-light font-medium transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-gray-300 pb-6">
          © {new Date().getFullYear()} Fotopzia · Todos los derechos reservados
        </p>

      </div>
    </div>
  )
}
