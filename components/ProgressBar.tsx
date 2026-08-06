import React from 'react';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  progress: number; // 0 to 100
  label?: string;
}

export default function ProgressBar({ progress, label }: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={styles.wrapper}>
      {label && (
        <div className={styles.labelRow}>
          <span>{label}</span>
          <span className="tabular-nums">{Math.round(clampedProgress)}%</span>
        </div>
      )}
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${clampedProgress}%` }} />
      </div>
    </div>
  );
}
