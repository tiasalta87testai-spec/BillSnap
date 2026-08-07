'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ImageCapture from '@/components/ImageCapture';
import LoadingState from '@/components/LoadingState';
import Toast, { ToastMessage } from '@/components/Toast';
import { ProcessedImage } from '@/lib/types';
import { api, ApiError } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<ProcessedImage | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Caricamento immagine...');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const handleImageSelected = (processed: ProcessedImage) => {
    setSelectedImage(processed);
  };

  const handleImageCleared = () => {
    setSelectedImage(null);
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      setToast({ id: 'no-img', type: 'warning', text: 'Seleziona o scatta una foto prima di procedere' });
      return;
    }

    setIsAnalyzing(true);
    setProgress(15);
    setLoadingMessage('Caricamento immagine sul server...');

    try {
      // Step 1: Upload image to Supabase Storage via Edge Function
      const uploadRes = await api.uploadImage(selectedImage.file);
      
      setProgress(50);
      setLoadingMessage('Analisi AI con Gemini in corso...');

      // Step 2: Analyze image via Edge Function
      const analysisData = await api.analyzeReceipt(uploadRes.image_path);

      setProgress(95);
      setLoadingMessage('Elaborazione completata! Preparazione dati...');

      // Combine extracted data with image paths
      const completeData = {
        ...analysisData,
        image_path: uploadRes.image_path,
        thumbnail_path: uploadRes.thumbnail_path,
      };

      // Store extracted data in sessionStorage for review page
      sessionStorage.setItem('pending_receipt', JSON.stringify(completeData));
      sessionStorage.setItem('pending_preview_url', selectedImage.previewUrl);

      setTimeout(() => {
        router.push('/review');
      }, 500);

    } catch (err: unknown) {
      console.error(err);
      setIsAnalyzing(false);
      setProgress(0);

      let msg = 'Errore durante l\'analisi dello scontrino. Riprova.';
      if (err instanceof ApiError) {
        msg = err.message;
      } else if (err instanceof Error) {
        msg = err.message;
      }

      setToast({ id: 'err-analyze', type: 'error', text: msg });
    }
  };

  return (
    <div style={{ width: '100%', minHeight: 'calc(100vh - 120px)' }}>
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {isAnalyzing ? (
        <LoadingState
          progress={progress}
          message="Analisi Scontrino"
          subMessage={loadingMessage}
        />
      ) : (
        <div>
          <header style={{ marginBottom: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="BillSnap Logo"
              style={{
                width: '72px',
                height: '72px',
                objectFit: 'contain',
                marginBottom: '12px',
                filter: 'drop-shadow(0 4px 16px rgba(59, 130, 246, 0.45))'
              }}
            />
            <h1 className="display" style={{ color: 'var(--color-primary-container)', background: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              BillSnap
            </h1>
            <p className="body-md" style={{ color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
              Gestione intelligente di scontrini e ricevute
            </p>
          </header>

          <ImageCapture
            selectedImage={selectedImage}
            onImageSelected={handleImageSelected}
            onImageCleared={handleImageCleared}
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
          />
        </div>
      )}
    </div>
  );
}
