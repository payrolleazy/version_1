import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabaseServerClient'

export async function middleware(request: NextRequest) {
  const supabase = createClient()

  const { data: { session } } = await supabase.auth.getSession()

  const authRoutes = ['/login', '/signup', '/forgot-password', '/update-password']
  const isAuthRoute = authRoutes.includes(request.nextUrl.pathname)

  if (session && isAuthRoute) {
    // Redirect authenticated users from auth routes to home
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!session && !isAuthRoute) {
    // Redirect unauthenticated users from protected routes to login
    // You can define which routes are protected here, for now, all non-auth routes are protected
    if (request.nextUrl.pathname !== '/') { // Allow access to home page even if not authenticated
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder (e.g. /vercel.svg)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*) ',
  ],
}
