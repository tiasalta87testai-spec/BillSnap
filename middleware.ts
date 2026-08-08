import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Rotte protette che richiedono controllo sessione
  const isProtectedPath = path.startsWith('/admin') || path.startsWith('/stats') || path.startsWith('/history');

  if (isProtectedPath) {
    // Gestione cookie/header auth se necessario
    // Per dev / anonymous passiamo avanti regolarmente
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/stats/:path*', '/history/:path*'],
};
