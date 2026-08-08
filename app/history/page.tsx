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
import { Download, RefreshCw } from 'lucide-react';

export default function HistoryPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pageLimit, setPageLimit] = useState(20);
  const [hasMore, setHasMore] = useState(false);
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

      const { data, error } = await query.limit(pageLimit + 1);

      if (error) {
        throw error;
      }

      if (data && data.length > pageLimit) {
        setHasMore(true);
        setReceipts(data.slice(0, pageLimit));
      } else {
        setHasMore(false);
        setReceipts(data || []);
      }
    } catch (err: unknown) {
      console.error('Errore durante il recupero dello storico:', err);
      const msg = err instanceof Error ? err.message : 'Errore nel caricamento delle ricevute';
      setToast({ id: 'err-fetch', type: 'error', text: msg });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, startDate, endDate, pageLimit]);

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

  const handleLoadMore = () => {
    setPageLimit(prev => prev + 20);
  };

  const exportToCSV = () => {
    if (receipts.length === 0) return;

    const headers = ['ID', 'Data', 'Esercente', 'Categoria', 'Importo Totale (€)', 'Metodo Pagamento', 'Note', 'Stato Backup Cloud', 'Link Cloud'];
    const rows = receipts.map(r => [
      `"${r.id}"`,
      `"${r.receipt_date || ''}"`,
      `"${(r.vendor_name || '').replace(/"/g, '""')}"`,
      `"${(r.category || '').replace(/"/g, '""')}"`,
      r.total_amount ? r.total_amount.toFixed(2) : '0.00',
      `"${(r.payment_method || '').replace(/"/g, '""')}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
      `"${r.cloud_sync_status || 'pending'}"`,
      `"${r.cloud_file_url || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BillSnap_Export_Spese_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToast({ id: 'csv-ok', type: 'success', text: `Esportati ${receipts.length} scontrini in CSV con successo!` });
  };

  const totalSum = receipts.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '80px' }}>
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* HEADER E CONTATORE */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="headline-lg">Storico Ricevute</h1>
          <p className="body-md" style={{ color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
            {isLoading ? 'Caricamento...' : `${receipts.length} ricevute visualizzate`}
          </p>
        </div>
        {!isLoading && receipts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ textAlign: 'right' }}>
              <span className="label-sm" style={{ color: 'var(--color-on-surface-variant)' }}>TOTALE PARZIALE</span>
              <div className="headline-md tabular-nums" style={{ color: 'var(--color-primary-container)' }}>
                {formatCurrency(totalSum)}
              </div>
            </div>
            <button
              onClick={exportToCSV}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Download size={14} />
              Esporta CSV
            </button>
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
      {isLoading && pageLimit === 20 && (
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

          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={isLoading}
              style={{
                padding: '12px',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: '10px',
                border: '1px solid var(--color-border-card, #1e293b)',
                backgroundColor: 'var(--color-surface-container, #131d33)',
                color: '#60a5fa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '12px',
              }}
            >
              {isLoading ? 'Caricamento altri...' : 'Carica Altri Scontrini'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
