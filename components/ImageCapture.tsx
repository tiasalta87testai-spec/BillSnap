'use client';

import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, X, Upload, Sparkles, CheckCircle2 } from 'lucide-react';
import { processImage } from '@/lib/image-utils';
import { ProcessedImage } from '@/lib/types';
import { formatFileSize } from '@/lib/format';
import styles from './ImageCapture.module.css';

interface ImageCaptureProps {
  onImageSelected: (processed: ProcessedImage) => void;
  onImageCleared: () => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  selectedImage: ProcessedImage | null;
}

export default function ImageCapture({
  onImageSelected,
  onImageCleared,
  onAnalyze,
  isAnalyzing,
  selectedImage,
}: ImageCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("L'immagine è troppo grande (max 10 MB)");
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const processed = await processImage(file);
      onImageSelected(processed);
    } catch (err) {
      console.error(err);
      setErrorMessage("Errore nella preparazione dell'immagine. Riprova");
    } finally {
      setIsProcessing(false);
      // Reset input value so re-selecting same file triggers change
      e.target.value = '';
    }
  };

  return (
    <div className={styles.container}>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />

      {!selectedImage ? (
        <div className={styles.uploadBox}>
          <div style={{ color: 'var(--color-primary-container)' }}>
            <Upload size={48} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="headline-md">Acquisisci Scontrino</h2>
            <p className="body-md" style={{ color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
              Scatta una foto o carica un file per estrarre automaticamente i dati con l'IA.
            </p>
          </div>

          <div className={styles.actionButtons}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isProcessing}
            >
              <Camera size={20} />
              <span>Scatta Foto</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => galleryInputRef.current?.click()}
              disabled={isProcessing}
            >
              <ImageIcon size={20} />
              <span>Galleria</span>
            </button>
          </div>

          {isProcessing && (
            <p className="label-md" style={{ color: 'var(--color-primary-container)' }}>
              Ottimizzazione immagine in corso...
            </p>
          )}

          {errorMessage && (
            <p className="label-md" style={{ color: 'var(--color-error)' }} role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      ) : (
        <div className={styles.previewWrapper}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedImage.previewUrl}
            alt="Anteprima scontrino"
            className={styles.previewImage}
          />
          <button
            type="button"
            className={styles.removeButton}
            onClick={onImageCleared}
            aria-label="Rimuovi immagine"
            title="Rimuovi"
          >
            <X size={20} />
          </button>
          <div className={styles.compressionBadge}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={16} color="var(--color-success)" /> Immagine ottimizzata
            </span>
            <span>
              {formatFileSize(selectedImage.originalSize)} &rarr; {formatFileSize(selectedImage.compressedSize)}
            </span>
          </div>
        </div>
      )}

      {selectedImage && (
        <button
          type="button"
          className="btn-primary btn-large"
          onClick={onAnalyze}
          disabled={isAnalyzing || isProcessing}
        >
          <Sparkles size={22} />
          <span>{isAnalyzing ? 'Analisi AI in corso...' : 'Analizza scontrino'}</span>
        </button>
      )}
    </div>
  );
}
