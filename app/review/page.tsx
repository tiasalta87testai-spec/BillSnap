'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ReviewForm from '@/components/ReviewForm';
import Toast, { ToastMessage } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Receipt } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { api, ApiError } from '@/lib/api';
import { CheckCircle2, ArrowLeft, History, Home } from 'lucide-react';
import Link from 'next/link';

export default function ReviewPage() {
  const router = useRouter();
  const [initialData, setInitialData] = useState<Partial<Receipt> | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessData, setSaveSuccessData] = useState<{ id: string; vendor: string; date: string; amount: number } | null>(null);
  const [duplicateWarningData, setDuplicateWarningData] = useState<Partial<Receipt> | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('pending_receipt');
    const storedPreview = sessionStorage.getItem('pending_preview_url');

    if (!raw) {
      router.replace('/');
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setInitialData(parsed);
      if (storedPreview) setPreviewUrl(storedPreview);
    } catch {
      router.replace('/');
    }
  }, [router]);

  const handleSave = async (data: Partial<Receipt>, forceSave = false) => {
    setIsSaving(true);
    setToast(null);

    try {
      const payload = {
        ...data,
        force_save: forceSave,
      };

      const result = await api.saveReceipt(payload);

      if (result.is_duplicate_warning && !forceSave) {
        setIsSaving(false);
        setDuplicateWarningData(data);
        return;
      }

      // Success
      sessionStorage.removeItem('pending_receipt');
      sessionStorage.removeItem('pending_preview_url');

      setSaveSuccessData({
        id: result.id,
        vendor: data.vendor_name || 'Scontrino',
        date: data.receipt_date || new Date().toISOString(),
        amount: data.total_amount || 0,
      });

    } catch (err: unknown) {
      console.error(err);
      setIsSaving(false);

      let msg = 'Errore durante il salvataggio dello scontrino. Riprova.';
      if (err instanceof ApiError) msg = err.message;
      else if (err instanceof Error) msg = err.message;

      setToast({ id: 'err-save', type: 'error', text: msg });
    }
  };

  const handleConfirmDuplicate = () => {
    if (duplicateWarningData) {
      const data = duplicateWarningData;
      setDuplicateWarningData(null);
      handleSave(data, true);
    }
  };

  if (!initialData && !saveSuccessData) {
    return (
      <div style={{ textAlign: 'center', paddingTop: '40px' }}>
        <p className="body-md" style={{ color: 'var(--color-on-surface-variant)' }}>Caricamento dati...</p>
      </div>
    );
  }

  // SCREEN 4: CONFERMA SALVATAGGIO
  if (saveSuccessData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '75vh', textAlign: 'center', gap: '24px' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(0, 184, 148, 0.15)', color: '#00B894', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle2 size={48} />
        </div>

        <div>
          <h1 className="headline-lg">Scontrino Salvato!</h1>
          <p className="body-md" style={{ color: 'var(--color-on-surface-variant)', marginTop: '8px' }}>
            I dati sono stati archiviati correttamente nel database.
          </p>
        </div>

        <div className="card" style={{ width: '100%', maxWidth: '360px', textAlign: 'left' }}>
          <div className="label-sm" style={{ color: 'var(--color-on-surface-variant)' }}>RIEPILOGO RICEVUTA</div>
          <div className="headline-md" style={{ marginTop: '4px' }}>{saveSuccessData.vendor}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
            <span className="body-md" style={{ color: 'var(--color-on-surface-variant)' }}>Data: {formatDate(saveSuccessData.date)}</span>
            <span className="body-lg tabular-nums" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
              {formatCurrency(saveSuccessData.amount)}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '360px' }}>
          <Link href="/" className="btn-primary btn-large">
            <Home size={20} />
            <span>Torna a Home</span>
          </Link>
          <Link href="/history" className="btn-secondary btn-large">
            <History size={20} />
            <span>Vai allo storico</span>
          </Link>
        </div>
      </div>
    );
  }

  // SCREEN 3: REVISIONE DATI ESTRATTI
  return (
    <div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <header style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="btn-tertiary"
          aria-label="Torna indietro"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="headline-lg">Revisione Dati</h1>
          <p className="body-md" style={{ color: 'var(--color-on-surface-variant)' }}>
            Verifica e correggi i dati estratti dall'IA
          </p>
        </div>
      </header>

      {initialData && (
        <ReviewForm
          initialData={initialData}
          imageUrl={previewUrl}
          onSave={(data) => handleSave(data, false)}
          onReanalyze={() => router.push('/')}
          isSaving={isSaving}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(duplicateWarningData)}
        title="Possibile Scontrino Duplicato"
        message="Risulta già presente uno scontrino con lo stesso esercente, data ed importo. Vuoi salvarlo comunque?"
        confirmText="Salva Comunque"
        cancelText="Annulla"
        onConfirm={handleConfirmDuplicate}
        onCancel={() => setDuplicateWarningData(null)}
      />
    </div>
  );
}
