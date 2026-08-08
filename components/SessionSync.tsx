'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function SessionSync() {
  useEffect(() => {
    // Sincronizza lo stato di autenticazione client con un cookie leggero per il server
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // Salva solo l'access_token (JWT) anziché l'intero oggetto sessione per evitare l'errore HTTP 431
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax; Secure`;
        
        // Pulisce in automatico il vecchio cookie sb-auth-token sovradimensionato
        document.cookie = `sb-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure`;
      } else {
        // Rimuove tutti i cookie di autenticazione in caso di disconnessione
        document.cookie = `sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure`;
        document.cookie = `sb-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure`;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
