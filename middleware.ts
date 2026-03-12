import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isStaticAsset =
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/icons') ||
    pathname === '/manifest.json' ||
    /\.[a-zA-Z0-9]+$/.test(pathname)

  if (isStaticAsset) {
    return NextResponse.next()
  }

  const publicPaths = ['/login', '/forgot-password', '/auth/callback']
  const isPublic = publicPaths.some(p => pathname.startsWith(p))
  const isClientPortal = pathname.startsWith('/portal/')
  const isClientPortalApi = pathname.startsWith('/api/portal/')
  const requiresAuth = !isPublic && !isClientPortal && !isClientPortalApi

  if (!requiresAuth && !isPublic) {
    return NextResponse.next({ request })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[middleware] Missing Supabase environment variables.')
    return NextResponse.next({ request })
  }

  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user && requiresAuth) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (user && isPublic) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return supabaseResponse
  } catch (error) {
    console.error('[middleware] Invocation failed:', error)
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)'],
}
