// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the pathname
  const pathname = request.nextUrl.pathname;
  
  // Define public paths
  const publicPaths = ['/login', '/register', '/forgot-password'];
  const isPublicPath = publicPaths.includes(pathname);
  
  // Get token from cookies
  const token = request.cookies.get('auth_token')?.value;
  const isAuthenticated = !!token;
  
  // Handle redirects
  if (isAuthenticated && isPublicPath) {
    // Redirect authenticated users away from public pages
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // Don't protect API routes
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};