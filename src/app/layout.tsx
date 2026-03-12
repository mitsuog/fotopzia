import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Fotopzia',
  description: 'Sistema de gestion para Fotopzia - estudio fotografico y de video profesional en Ciudad de Mexico',
  icons: {
    icon: '/logocuadradoFotopzia.png',
    shortcut: '/logocuadradoFotopzia.png',
    apple: '/logocuadradoFotopzia.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body suppressHydrationWarning className={`${montserrat.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}

