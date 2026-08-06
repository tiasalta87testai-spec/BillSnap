'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './ImageZoom.module.css';

interface ImageZoomProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export default function ImageZoom({ src, alt = 'Immagine scontrino ingrandita', onClose }: ImageZoomProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <button
        type="button"
        className={styles.closeBtn}
        onClick={onClose}
        aria-label="Chiudi zoom"
      >
        <X size={24} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={styles.image}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
