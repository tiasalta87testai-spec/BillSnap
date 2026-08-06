import React from 'react';
import { Receipt } from 'lucide-react';
import Link from 'next/link';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title = 'Nessuno scontrino trovato',
  description = 'Non hai ancora registrato scontrini o la ricerca non ha prodotto risultati.',
  actionText,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className={styles.container}>
      <div className={styles.iconWrapper}>
        <Receipt size={32} />
      </div>

      <div>
        <h3 className={`headline-md ${styles.title}`}>{title}</h3>
        <p className={`body-md ${styles.description}`}>{description}</p>
      </div>

      {actionText && actionHref && (
        <Link href={actionHref} className="btn-primary" style={{ marginTop: '8px' }}>
          {actionText}
        </Link>
      )}

      {actionText && onAction && !actionHref && (
        <button type="button" className="btn-primary" onClick={onAction} style={{ marginTop: '8px' }}>
          {actionText}
        </button>
      )}
    </div>
  );
}
