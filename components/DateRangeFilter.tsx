'use client';

import React from 'react';
import { Calendar, X } from 'lucide-react';
import styles from './DateRangeFilter.module.css';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClear: () => void;
}

export default function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
}: DateRangeFilterProps) {
  const hasFilter = Boolean(startDate || endDate);

  return (
    <div className={styles.container}>
      <Calendar size={18} color="var(--color-on-surface-variant)" style={{ flexShrink: 0 }} />
      <input
        type="date"
        className={styles.dateInput}
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
        aria-label="Data inizio"
      />
      <span style={{ color: 'var(--color-outline)' }}>-</span>
      <input
        type="date"
        className={styles.dateInput}
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
        aria-label="Data fine"
      />
      {hasFilter && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={onClear}
          title="Rimuovi filtro date"
          aria-label="Rimuovi filtro date"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
