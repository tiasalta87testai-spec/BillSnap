import React from 'react';
import Link from 'next/link';
import { Receipt } from '@/lib/types';
import { formatCurrency, formatDate, formatLabel } from '@/lib/format';
import { Receipt as ReceiptIcon, ChevronRight } from 'lucide-react';
import Badge from './Badge';
import styles from './ReceiptCard.module.css';

interface ReceiptCardProps {
  receipt: Receipt;
}

export default function ReceiptCard({ receipt }: ReceiptCardProps) {
  const vendorName = receipt.vendor_name || 'Esercente non specificato';
  const displayDate = formatDate(receipt.receipt_date || receipt.created_at);
  const formattedAmount = formatCurrency(receipt.total_amount, receipt.currency);

  return (
    <Link href={`/receipt/${receipt.id}`} className={styles.card}>
      {receipt.thumbnail_path || receipt.image_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={receipt.thumbnail_path || receipt.image_url!}
          alt={`Scontrino di ${vendorName}`}
          className={styles.thumbnail}
        />
      ) : (
        <div className={styles.thumbnailPlaceholder}>
          <ReceiptIcon size={28} />
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.vendor}>{vendorName}</div>
        <div className={styles.meta}>
          <span>{displayDate}</span>
          {receipt.category && (
            <Badge variant="neutral">
              {formatLabel(receipt.category)}
            </Badge>
          )}
        </div>
      </div>

      <div className={styles.rightColumn}>
        <div className={styles.amount}>{formattedAmount}</div>
        <ChevronRight size={18} color="var(--color-outline)" />
      </div>
    </Link>
  );
}
