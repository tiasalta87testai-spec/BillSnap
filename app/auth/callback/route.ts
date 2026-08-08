import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // Client Supabase temporaneo per lo scambio del code server-side
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false
      }
    });

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) throw error;

      if (data.session) {
        // Creiamo la risposta di redirect per il login riuscito
        const response = NextResponse.redirect(new URL('/login?status=success', request.url));
        
        // Impostiamo il cookie sb-auth-token per renderlo leggibile al middleware e al client
        const sessionString = JSON.stringify(data.session);
        response.cookies.set('sb-auth-token', sessionString, {
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 giorni
          sameSite: 'lax',
          secure: true
        });
        
        return response;
      }
    } catch (err: any) {
      console.error('Error exchanging OAuth code for session:', err);
      const errMsg = encodeURIComponent(err.message || 'Errore durante lo scambio del codice di sessione');
      return NextResponse.redirect(new URL(`/login?error=${errMsg}`, request.url));
    }
  }

  return NextResponse.redirect(new URL('/login?error=Codice%20di%20autenticazione%20mancante', request.url));
}
