import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const tokenCookie = request.cookies.get('sb-auth-token');
  const { pathname } = request.nextUrl;

  // Definiamo le rotte pubbliche che non richiedono autenticazione
  const isPublicRoute = pathname === '/login' || pathname.startsWith('/auth/callback');

  // Se l'utente NON è autenticato e prova ad accedere a una rotta protetta
  if (!tokenCookie && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Se l'utente è autenticato e prova ad accedere a /login, lo rimandiamo in Home
  if (tokenCookie && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// Esclude il controllo sui file statici, immagini, icone e favicon
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|logo.png|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg).*)',
  ],
};
