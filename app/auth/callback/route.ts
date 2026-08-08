import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Client Supabase temporaneo per lo scambio dei token server-side
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false
    }
  });

  try {
    // 1. Caso Flusso OAuth2 (es: Accedi con Google che restituisce 'code')
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;

      if (data.session) {
        const response = NextResponse.redirect(new URL('/login?status=success', request.url));
        response.cookies.set('sb-auth-token', JSON.stringify(data.session), {
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 giorni
          sameSite: 'lax',
          secure: true
        });
        return response;
      }
    }

    // 2. Caso Flusso di Conferma Email (che restituisce 'token_hash' e 'type')
    if (token_hash && type) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as any,
      });
      if (error) throw error;

      if (data.session) {
        const response = NextResponse.redirect(new URL('/login?status=success', request.url));
        response.cookies.set('sb-auth-token', JSON.stringify(data.session), {
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
          sameSite: 'lax',
          secure: true
        });
        return response;
      } else {
        // Se non viene creata una sessione immediata, reindirizza comunque confermando il successo
        return NextResponse.redirect(new URL('/login?status=success', request.url));
      }
    }
  } catch (err: any) {
    console.error('Error in auth callback:', err);
    const errMsg = encodeURIComponent(err.message || 'Errore durante la convalida della sessione');
    return NextResponse.redirect(new URL(`/login?error=${errMsg}`, request.url));
  }

  // Se mancano entrambi i parametri
  return NextResponse.redirect(new URL('/login?error=Parametri%20di%20autenticazione%20non%20validi%20o%20mancanti', request.url));
}
