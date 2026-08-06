'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { UserStats } from '@/lib/types';
import { BarChart3, TrendingUp, Receipt, PieChart, FolderKanban, AlertCircle, RefreshCw } from 'lucide-react';

const CATEGORY_COLORS: Record<string, string> = {
  alimentari: '#10B981', // Verde
  trasporti: '#3B82F6',  // Blu
  ufficio: '#8B5CF6',    // Viola
  ristorazione: '#F59E0B',// Arancione
  salute: '#EF4444',     // Rosso
  abbigliamento: '#EC4899',// Rosa
  altro: '#6B7280',      // Grigio
};

export default function StatsPage() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUserStats();
      setStats(data);
    } catch (err: unknown) {
      console.error('Error loading stats:', err);
      setError('Impossibile caricare le statistiche. Verifica la connessione.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <RefreshCw size={36} className="spin" style={{ color: 'var(--color-primary, #2563eb)' }} />
        <p style={{ color: 'var(--color-secondary, #64748b)', fontSize: '15px' }}>Elaborazione statistiche in corso...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--color-on-background, #fff)', marginBottom: '16px' }}>{error}</p>
        <button
          onClick={fetchStats}
          style={{
            padding: '10px 20px',
            backgroundColor: 'var(--color-primary, #2563eb)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Riprova
        </button>
      </div>
    );
  }

  const maxCategoryTotal = stats?.category_spending?.reduce((max, c) => Math.max(max, c.total), 0) || 1;
  const maxMonthlyTotal = stats?.monthly_trends?.reduce((max, m) => Math.max(max, m.total), 0) || 1;

  return (
    <div style={{ paddingBottom: '80px' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BarChart3 style={{ color: 'var(--color-primary, #2563eb)' }} />
          Statistiche Spese
        </h1>
        <p style={{ color: 'var(--color-secondary, #94a3b8)', margin: 0, fontSize: '14px' }}>
          Analisi aggregata delle tue ricevute e scontrini
        </p>
      </header>

      {/* METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        <div style={{ background: 'var(--color-surface-container, #1e293b)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border-card, #334155)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-secondary, #94a3b8)', fontSize: '13px', marginBottom: '6px' }}>
            <TrendingUp size={16} style={{ color: '#10b981' }} />
            <span>Spesa Totale</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-on-surface, #f8fafc)' }}>
            €{stats?.total_spending.toFixed(2) || '0.00'}
          </div>
        </div>

        <div style={{ background: 'var(--color-surface-container, #1e293b)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border-card, #334155)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-secondary, #94a3b8)', fontSize: '13px', marginBottom: '6px' }}>
            <BarChart3 size={16} style={{ color: '#3b82f6' }} />
            <span>Spesa Media</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-on-surface, #f8fafc)' }}>
            €{stats?.average_spending.toFixed(2) || '0.00'}
          </div>
        </div>

        <div style={{ background: 'var(--color-surface-container, #1e293b)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border-card, #334155)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-secondary, #94a3b8)', fontSize: '13px', marginBottom: '6px' }}>
            <Receipt size={16} style={{ color: '#8b5cf6' }} />
            <span>Totale Scontrini</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-on-surface, #f8fafc)' }}>
            {stats?.total_receipts || 0}
          </div>
        </div>
      </div>

      {/* RAGGRUPPAMENTO PER CATEGORIA */}
      <section style={{ background: 'var(--color-surface-container, #1e293b)', padding: '20px', borderRadius: '14px', border: '1px solid var(--color-border-card, #334155)', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PieChart size={18} style={{ color: '#10b981' }} />
          Spesa per Categoria
        </h2>

        {(!stats?.category_spending || stats.category_spending.length === 0) ? (
          <p style={{ color: 'var(--color-secondary, #94a3b8)', fontSize: '14px', margin: 0 }}>Nessuna categoria registrata.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {stats.category_spending.map((item) => {
              const color = CATEGORY_COLORS[item.category.toLowerCase()] || '#3b82f6';
              const percent = Math.round((item.total / maxCategoryTotal) * 100);
              return (
                <div key={item.category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{item.category} ({item.count})</span>
                    <span style={{ fontWeight: 700 }}>€{item.total.toFixed(2)}</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', backgroundColor: color, borderRadius: '6px', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ANDAMENTO MENSILE */}
      <section style={{ background: 'var(--color-surface-container, #1e293b)', padding: '20px', borderRadius: '14px', border: '1px solid var(--color-border-card, #334155)', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={18} style={{ color: '#3b82f6' }} />
          Andamento Mensile Spese
        </h2>

        {(!stats?.monthly_trends || stats.monthly_trends.length === 0) ? (
          <p style={{ color: 'var(--color-secondary, #94a3b8)', fontSize: '14px', margin: 0 }}>Nessun dato mensile disponibile.</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '140px', paddingTop: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', overflowX: 'auto' }}>
            {stats.monthly_trends.map((m) => {
              const heightPercent = Math.max(12, Math.round((m.total / maxMonthlyTotal) * 100));
              return (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', minWidth: '45px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-primary, #3b82f6)', marginBottom: '4px' }}>€{m.total.toFixed(0)}</span>
                  <div style={{ width: '100%', maxWidth: '28px', height: `${heightPercent}%`, backgroundColor: '#3b82f6', borderRadius: '4px 4px 0 0', opacity: 0.85 }} />
                  <span style={{ fontSize: '11px', color: 'var(--color-secondary, #94a3b8)', marginTop: '6px' }}>{m.month.substring(5)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* RAGGRUPPAMENTO PER GRUPPI / FALDONI */}
      <section style={{ background: 'var(--color-surface-container, #1e293b)', padding: '20px', borderRadius: '14px', border: '1px solid var(--color-border-card, #334155)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderKanban size={18} style={{ color: '#8b5cf6' }} />
          Gruppi e Faldoni di Spesa
        </h2>

        {(!stats?.group_spending || stats.group_spending.length === 0) ? (
          <p style={{ color: 'var(--color-secondary, #94a3b8)', fontSize: '14px', margin: 0 }}>Nessun gruppo o faldone creato.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stats.group_spending.map((g) => (
              <div key={g.group_id || 'none'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: g.color || '#8b5cf6' }} />
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>{g.group_name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-secondary, #94a3b8)' }}>({g.count} scontrini)</span>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>€{g.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
