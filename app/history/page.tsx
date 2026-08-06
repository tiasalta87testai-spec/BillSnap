'use client';

import React, { useState, useEffect, useCallback } from 'react';
import SearchBar from '@/components/SearchBar';
import DateRangeFilter from '@/components/DateRangeFilter';
import ReceiptCard from '@/components/ReceiptCard';
import SkeletonCard from '@/components/SkeletonCard';
import EmptyState from '@/components/EmptyState';
import Toast, { ToastMessage } from '@/components/Toast';
import { Receipt } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { Receipt as ReceiptIcon, RefreshCw } from 'lucide-react';

export default function HistoryPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const fetchReceipts = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('receipts')
        .select('*')
        .neq('status', 'deleted')
        .order('receipt_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (searchQuery.trim()) {
        query = query.ilike('vendor_name', `%${searchQuery.trim()}%`);
      }

      if (startDate) {
        query = query.gte('receipt_date', startDate);
      }

      if (endDate) {
        query = query.lte('receipt_date', endDate);
      }

      const { data, error } = await query.limit(50);

      if (error) {
        throw error;
      }

      setReceipts(data || []);
    } catch (err: unknown) {
      console.error('Errore durante il recupero dello storico:', err);
      const msg = err instanceof Error ? err.message : 'Errore nel caricamento delle ricevute';
      setToast({ id: 'err-fetch', type: 'error', text: msg });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, startDate, endDate]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchReceipts();
  };

  const handleClearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  const totalSum = receipts.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* HEADER E CONTATORE */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="headline-lg">Storico Ricevute</h1>
          <p className="body-md" style={{ color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
            {isLoading ? 'Caricamento...' : `${receipts.length} ricevute trovate`}
          </p>
        </div>
        {!isLoading && receipts.length > 0 && (
          <div style={{ textAlign: 'right' }}>
            <span className="label-sm" style={{ color: 'var(--color-on-surface-variant)' }}>TOTALE SPESO</span>
            <div className="headline-md tabular-nums" style={{ color: 'var(--color-primary-container)' }}>
              {formatCurrency(totalSum)}
            </div>
          </div>
        )}
      </header>

      {/* STRUMENTI DI RICERCA E FILTRO */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Cerca per nome esercente..."
        />
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClear={handleClearDateFilter}
        />
      </div>

      {/* LISTA RICEVUTE */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!isLoading && receipts.length === 0 && (
        <EmptyState
          title="Nessuna ricevuta trovata"
          description={
            searchQuery || startDate || endDate
              ? 'Nessun risultato corrisponde ai filtri selezionati.'
              : 'Non hai ancora salvato alcuna ricevuta. Scatta una foto per iniziare!'
          }
          actionText={searchQuery || startDate || endDate ? 'Azzera filtri' : 'Acquisisci scontrino'}
          onAction={searchQuery || startDate || endDate ? () => { setSearchQuery(''); handleClearDateFilter(); } : undefined}
          actionHref={!(searchQuery || startDate || endDate) ? '/' : undefined}
        />
      )}

      {!isLoading && receipts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {receipts.map((receipt) => (
            <ReceiptCard key={receipt.id} receipt={receipt} />
          ))}
        </div>
      )}
    </div>
  );
}
