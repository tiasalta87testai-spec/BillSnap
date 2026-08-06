import React from 'react';
import styles from './SkeletonCard.module.css';

export default function SkeletonCard() {
  return (
    <div className={styles.card}>
      <div className={styles.thumbnail} />
      <div className={styles.content}>
        <div className={styles.lineLong} />
        <div className={styles.lineShort} />
      </div>
      <div className={styles.amount} />
    </div>
  );
}
