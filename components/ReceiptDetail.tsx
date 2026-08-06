'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Receipt } from '@/lib/types';
import { formatCurrency, formatDate, formatLabel } from '@/lib/format';
import ImageZoom from './ImageZoom';
import ConfirmDialog from './ConfirmDialog';
import Badge from './Badge';
import { Maximize2, Edit3, Trash2, Calendar, CreditCard, Tag, FileText, ShoppingBag } from 'lucide-react';
import styles from './ReceiptDetail.module.css';

interface ReceiptDetailProps {
  receipt: Receipt;
  onDelete: () => void;
  isDeleting?: boolean;
}

export default function ReceiptDetail({ receipt, onDelete, isDeleting = false }: ReceiptDetailProps) {
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const vendorName = receipt.vendor_name || 'Esercente non specificato';
  const displayAmount = formatCurrency(receipt.total_amount, receipt.currency);
  const imageUrl = receipt.image_url || receipt.image_path;

  return (
    <div className={styles.container}>
      {imageUrl && (
        <div className={styles.headerImageWrapper} onClick={() => setIsZoomOpen(true)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={`Scontrino ${vendorName}`} className={styles.headerImage} />
          <div className={styles.zoomBadge}>
            <Maximize2 size={14} />
            <span>Tocca per ingrandire</span>
          </div>
        </div>
      )}

      {isZoomOpen && imageUrl && (
        <ImageZoom src={imageUrl} onClose={() => setIsZoomOpen(false)} />
      )}

      {/* HEADER PRINCIPALE */}
      <div className={styles.headerInfo}>
        <div>
          <h1 className={`headline-lg ${styles.vendorTitle}`}>{vendorName}</h1>
          <p className="body-md" style={{ color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
            {formatDate(receipt.receipt_date)} {receipt.receipt_time ? `ore ${receipt.receipt_time}` : ''}
          </p>
        </div>
        <div className={styles.totalAmount}>{displayAmount}</div>
      </div>

      {/* DETTAGLI PRINCIPALI */}
      <div className={styles.section}>
        <div className={styles.gridProps}>
          {receipt.category && (
            <div className={styles.propItem}>
              <span className={styles.propLabel}>Categoria</span>
              <div style={{ marginTop: '2px' }}>
                <Badge variant="neutral">{formatLabel(receipt.category)}</Badge>
              </div>
            </div>
          )}

          {receipt.document_type && (
            <div className={styles.propItem}>
              <span className={styles.propLabel}>Tipo Documento</span>
              <span className={styles.propValue}>{formatLabel(receipt.document_type)}</span>
            </div>
          )}

          {receipt.payment_method && (
            <div className={styles.propItem}>
              <span className={styles.propLabel}>Pagamento</span>
              <span className={styles.propValue}>{formatLabel(receipt.payment_method)}</span>
            </div>
          )}

          {receipt.vat_amount !== null && receipt.vat_amount !== undefined && (
            <div className={styles.propItem}>
              <span className={styles.propLabel}>Importo IVA</span>
              <span className={`${styles.propValue} tabular-nums`}>{formatCurrency(receipt.vat_amount, receipt.currency)}</span>
            </div>
          )}

          {receipt.vendor_vat_number && (
            <div className={styles.propItem}>
              <span className={styles.propLabel}>P. IVA Esercente</span>
              <span className={styles.propValue}>{receipt.vendor_vat_number}</span>
            </div>
          )}

          {receipt.receipt_number && (
            <div className={styles.propItem}>
              <span className={styles.propLabel}>N° Ricevuta</span>
              <span className={styles.propValue}>{receipt.receipt_number}</span>
            </div>
          )}
        </div>
      </div>

      {/* LISTA ARTICOLI (SE PRESENTE) */}
      {receipt.items && receipt.items.length > 0 && (
        <div className={styles.section}>
          <h3 className="headline-md" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={20} /> Articoli ({receipt.items.length})
          </h3>
          <div className={styles.itemsList}>
            {receipt.items.map((item, i) => (
              <div key={i} className={styles.itemRow}>
                <div>
                  <span className="body-md" style={{ fontWeight: 500 }}>{item.description}</span>
                  {item.quantity && item.quantity > 1 && (
                    <span className="label-sm" style={{ color: 'var(--color-on-surface-variant)', marginLeft: '8px' }}>
                      x{item.quantity}
                    </span>
                  )}
                </div>
                <span className="body-md tabular-nums" style={{ fontWeight: 600 }}>
                  {formatCurrency(item.total, receipt.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAG E NOTE (SE PRESENTI) */}
      {((receipt.tags && receipt.tags.length > 0) || receipt.notes) && (
        <div className={styles.section}>
          {receipt.tags && receipt.tags.length > 0 && (
            <div>
              <span className={styles.propLabel} style={{ display: 'block', marginBottom: '8px' }}>
                Tag
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {receipt.tags.map((t, idx) => (
                  <Badge key={idx} variant="info">#{t}</Badge>
                ))}
              </div>
            </div>
          )}

          {receipt.notes && (
            <div style={{ marginTop: receipt.tags?.length ? '12px' : '0' }}>
              <span className={styles.propLabel} style={{ display: 'block', marginBottom: '4px' }}>
                Note
              </span>
              <p className="body-md" style={{ color: 'var(--color-on-surface)', whiteSpace: 'pre-line' }}>
                {receipt.notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TIMESTAMPS */}
      <div className={styles.timestamps}>
        Acquisito il {formatDate(receipt.created_at)}
        {receipt.updated_at && ` • Modificato il ${formatDate(receipt.updated_at)}`}
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className={styles.bottomBar}>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setIsConfirmDeleteOpen(true)}
          disabled={isDeleting}
          style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
        >
          <Trash2 size={18} />
          <span>Elimina</span>
        </button>

        <Link
          href={`/receipt/${receipt.id}/edit`}
          className="btn-primary"
        >
          <Edit3 size={18} />
          <span>Modifica</span>
        </Link>
      </div>

      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        title="Elimina Ricevuta"
        message="Sei sicuro di voler eliminare definitivamente questa ricevuta? L'azione non potrà essere annullata."
        confirmText="Elimina"
        cancelText="Annulla"
        isDanger
        onConfirm={onDelete}
        onCancel={() => setIsConfirmDeleteOpen(false)}
      />
    </div>
  );
}
