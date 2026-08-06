'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReviewForm from '@/components/ReviewForm';
import SkeletonCard from '@/components/SkeletonCard';
import Toast, { ToastMessage } from '@/components/Toast';
import { Receipt } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { api, ApiError } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';

export default function EditReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

      if (error || !data) throw new Error('Ricevuta non trovata');

      let imageUrl = data.image_url;
      if (data.image_path) {
        try {
          const urlRes = await api.getSignedUrl(data.image_path);
          imageUrl = urlRes.signed_url;
        } catch {
          // Fallback
        }
      }

      setReceipt({ ...data, image_url: imageUrl });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Errore nel caricamento della ricevuta';
      setToast({ id: 'err-edit-load', type: 'error', text: msg });
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  const handleSave = async (updatedData: Partial<Receipt>) => {
    if (!id) return;
    setIsSaving(true);
    try {
      // Save updated fields via saveReceipt API or directly
      const payload = {
        ...receipt,
        ...updatedData,
        id,
        force_save: true,
      };

      await api.saveReceipt(payload);
      router.replace(`/receipt/${id}`);
    } catch (err: unknown) {
      console.error(err);
      setIsSaving(false);
      let msg = 'Errore durante la modifica della ricevuta';
      if (err instanceof ApiError) msg = err.message;
      else if (err instanceof Error) msg = err.message;

      setToast({ id: 'err-save-edit', type: 'error', text: msg });
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
          onClick={() => router.push(`/receipt/${id}`)}
          className="btn-tertiary"
          aria-label="Annulla modifica"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="headline-md">Modifica Ricevuta</h1>
      </header>

      <ReviewForm
        initialData={receipt}
        imageUrl={receipt.image_url ?? undefined}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </div>
  );
}
