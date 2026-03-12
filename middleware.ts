import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/forgot-password', '/auth/callback']

function isStaticAsset(pathname: string) {
  if (pathname.startsWith('/_next/')) return true
  if (pathname === '/favicon.ico') return true
  if (pathname.startsWith('/icons')) return true
  if (pathname === '/manifest.json') return true
  return /\.[a-zA-Z0-9]+$/.test(pathname)
}

function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some(cookie => {
    const name = cookie.name
    return name.startsWith('sb-') && name.includes('auth-token')
  })
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  const isPublic = PUBLIC_PATHS.some(path => pathname.startsWith(path))
  const isClientPortal = pathname.startsWith('/portal/')
  const isClientPortalApi = pathname.startsWith('/api/portal/')

  if (isClientPortal || isClientPortalApi) {
    return NextResponse.next()
  }

  const hasSession = hasSupabaseSessionCookie(request)

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|.*\\..*).*)'],
}
