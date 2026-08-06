'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReceiptDetail from '@/components/ReceiptDetail';
import SkeletonCard from '@/components/SkeletonCard';
import Toast, { ToastMessage } from '@/components/Toast';
import { Receipt } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { api, ApiError } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';

export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const fetchReceipt = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        throw new Error('Ricevuta non trovata');
      }

      // If image_path exists, get fresh signed URL from Edge Function if needed
      let imageUrl = data.image_url;
      if (data.image_path) {
        try {
          const urlRes = await api.getSignedUrl(data.image_path);
          imageUrl = urlRes.signed_url;
        } catch {
          // Fallback to existing or direct path
        }
      }

      setReceipt({ ...data, image_url: imageUrl });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Errore nel caricamento della ricevuta';
      setToast({ id: 'err-detail', type: 'error', text: msg });
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await api.deleteReceipt(id);
      router.replace('/history');
    } catch (err: unknown) {
      console.error(err);
      setIsDeleting(false);
      let msg = 'Impossibile eliminare la ricevuta';
      if (err instanceof ApiError) msg = err.message;
      else if (err instanceof Error) msg = err.message;

      setToast({ id: 'err-del', type: 'error', text: msg });
    }
  };

  if (isLoading) {
    return (
      <div style={{ paddingTop: '20px' }}>
        <SkeletonCard />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div style={{ textAlign: 'center', paddingTop: '40px' }}>
        <h2 className="headline-md">Ricevuta non trovata</h2>
        <p className="body-md" style={{ color: 'var(--color-on-surface-variant)', marginTop: '8px' }}>
          La ricevuta richiesta è stata eliminata o non esiste.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => router.push('/history')}
          style={{ marginTop: '20px' }}
        >
          Torna allo storico
        </button>
      </div>
    );
  }

  return (
    <div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <header style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => router.push('/history')}
          className="btn-tertiary"
          aria-label="Torna allo storico"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="headline-md">Dettaglio Ricevuta</h1>
      </header>

      <ReceiptDetail
        receipt={receipt}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
