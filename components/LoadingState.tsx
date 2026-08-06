import React from 'react';
import { Sparkles } from 'lucide-react';
import ProgressBar from './ProgressBar';
import styles from './LoadingState.module.css';

interface LoadingStateProps {
  progress?: number;
  message?: string;
  subMessage?: string;
}

export default function LoadingState({
  progress = 50,
  message = 'Analisi in corso...',
  subMessage = 'Estrazione dati tramite IA di Gemini',
}: LoadingStateProps) {
  return (
    <div className={styles.container}>
      <div className={styles.spinnerWrapper}>
        <div className={styles.spinner} />
        <div className={styles.iconOverlay}>
          <Sparkles size={28} />
        </div>
      </div>

      <div>
        <h2 className={`headline-md ${styles.title}`}>{message}</h2>
        <p className={`body-md ${styles.subtitle}`}>{subMessage}</p>
      </div>

      {progress !== undefined && (
        <div className={styles.progressContainer}>
          <ProgressBar progress={progress} label="Elaborazione" />
        </div>
      )}
    </div>
  );
}
