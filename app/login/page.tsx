'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Toast, { ToastMessage } from '@/components/Toast';
import { LogIn, UserPlus, Mail, Lock, AlertCircle, Sparkles } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    // Gestione di messaggi di successo o errore provenienti dai redirect (es: OAuth callback)
    const status = searchParams.get('status');
    const error = searchParams.get('error');
    if (status === 'success') {
      setToast({ id: 'auth-success', type: 'success', text: 'Accesso effettuato con successo!' });
      setTimeout(() => router.push('/'), 1500);
    } else if (error) {
      setToast({ id: 'auth-err', type: 'error', text: decodeURIComponent(error) });
    }
  }, [searchParams, router]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setToast({ id: 'missing-fields', type: 'warning', text: 'Inserisci tutti i campi obbligatori' });
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        // Registrazione nuovo utente
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          }
        });
        if (error) throw error;
        setToast({
          id: 'signup-ok',
          type: 'success',
          text: 'Registrazione completata! Verifica la tua mail se richiesto, oppure effettua il login.',
        });
        setIsRegister(false);
      } else {
        // Accesso utente esistente
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setToast({ id: 'login-ok', type: 'success', text: 'Accesso eseguito! Reindirizzamento...' });
        setTimeout(() => router.push('/'), 1000);
      }
    } catch (err: any) {
      console.error('Email authentication error:', err);
      setToast({ id: 'auth-error-msg', type: 'error', text: err.message || 'Errore durante l\'autenticazione' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      setToast({ id: 'oauth-error-msg', type: 'error', text: err.message || 'Errore durante l\'accesso con Google' });
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: '420px',
      background: 'rgba(30, 41, 59, 0.7)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '24px',
      padding: '36px 28px',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* LOGO */}
      <div style={{
        background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)',
        marginBottom: '16px'
      }}>
        <Sparkles color="#fff" size={32} />
      </div>

      <h1 style={{
        fontSize: '28px',
        fontWeight: 800,
        margin: '0 0 6px 0',
        background: 'linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        textAlign: 'center'
      }}>
        {isRegister ? 'Crea Account' : 'Bentornato'}
      </h1>
      <p style={{
        fontSize: '14px',
        color: '#94a3b8',
        margin: '0 0 28px 0',
        textAlign: 'center'
      }}>
        {isRegister ? 'Registrati per iniziare a gestire le tue spese' : 'Accedi a BillSnap per visualizzare i tuoi scontrini'}
      </p>

      {/* GOOGLE OAUTH */}
      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(255, 255, 255, 0.03)',
          color: '#f8fafc',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          transition: 'background 0.2s',
          marginBottom: '20px'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
      >
        {/* LOGO GOOGLE SVG */}
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91c1.7-1.56 2.69-3.86 2.69-6.6z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.2l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.33-1.58-5.04-3.7H.94v2.33A9 9 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.96 10.7a5.4 5.4 0 0 1 0-3.4V4.97H.94a9 9 0 0 0 0 8.06l3.02-2.33z"/>
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.1A9 9 0 0 0 .94 4.97l3.02 2.33c.7-2.12 2.7-3.72 5.04-3.72z"/>
        </svg>
        Continua con Google
      </button>

      <div style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
        color: '#475569',
        fontSize: '12px'
      }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
        <span>OPPURE</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
      </div>

      {/* FORM EMAIL */}
      <form onSubmit={handleEmailAuth} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
            Indirizzo Email
          </label>
          <div style={{ position: 'relative' }}>
            <Mail style={{ position: 'absolute', left: '12px', top: '12px', color: '#475569' }} size={16} />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@esempio.it"
              style={{
                width: '100%',
                padding: '12px 12px 12px 38px',
                borderRadius: '12px',
                background: 'var(--color-surface-container-lowest, #0f172a)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <Lock style={{ position: 'absolute', left: '12px', top: '12px', color: '#475569' }} size={16} />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '12px 12px 12px 38px',
                borderRadius: '12px',
                background: 'var(--color-surface-container-lowest, #0f172a)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, #8b5cf6, #2563eb)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(139, 92, 246, 0.2)',
            marginTop: '10px'
          }}
        >
          {loading ? 'Elaborazione in corso...' : (isRegister ? 'Registrati' : 'Accedi')}
          {isRegister ? <UserPlus size={16} /> : <LogIn size={16} />}
        </button>
      </form>

      {/* SWITCH TABS */}
      <div style={{ marginTop: '24px', fontSize: '13px', color: '#94a3b8' }}>
        {isRegister ? 'Hai già un account?' : 'Non hai ancora un account?'}
        <button
          onClick={() => {
            setIsRegister(!isRegister);
            setToast(null);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#60a5fa',
            fontWeight: 600,
            cursor: 'pointer',
            marginLeft: '6px',
            textDecoration: 'underline'
          }}
        >
          {isRegister ? 'Accedi qui' : 'Registrati qui'}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div style={{
      width: '100vw',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 20% 30%, rgba(139, 92, 246, 0.15), transparent 40%), radial-gradient(circle at 80% 70%, rgba(59, 130, 246, 0.15), transparent 40%), #0f172a',
      padding: '20px',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 9999,
      overflowY: 'auto'
    }}>
      <Suspense fallback={
        <div style={{
          color: '#cbd5e1',
          fontSize: '16px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(30, 41, 59, 0.7)',
          padding: '16px 24px',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.08)'
        }}>
          Caricamento autenticazione...
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
