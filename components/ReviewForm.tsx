'use client';

import React, { useState } from 'react';
import { Receipt, LineItem } from '@/lib/types';
import { DOCUMENT_TYPES, PAYMENT_METHODS, CATEGORIES, CONFIDENCE_THRESHOLD } from '@/lib/constants';
import LineItemsEditor from './LineItemsEditor';
import ChipInput from './ChipInput';
import ImageZoom from './ImageZoom';
import { Maximize2, AlertTriangle, FileText, ShoppingCart, Tag, Check, RefreshCw } from 'lucide-react';
import styles from './ReviewForm.module.css';

interface ReviewFormProps {
  initialData: Partial<Receipt>;
  imageUrl?: string;
  onSave: (data: Partial<Receipt>) => void;
  onReanalyze?: () => void;
  isSaving?: boolean;
}

export default function ReviewForm({
  initialData,
  imageUrl,
  onSave,
  onReanalyze,
  isSaving = false,
}: ReviewFormProps) {
  const [formData, setFormData] = useState<Partial<Receipt>>({
    vendor_name: initialData.vendor_name || '',
    vendor_vat_number: initialData.vendor_vat_number || '',
    total_amount: initialData.total_amount ?? 0,
    vat_amount: initialData.vat_amount ?? undefined,
    receipt_date: initialData.receipt_date || new Date().toISOString().split('T')[0],
    receipt_time: initialData.receipt_time || '',
    receipt_number: initialData.receipt_number || '',
    document_type: initialData.document_type || 'scontrino',
    payment_method: initialData.payment_method || 'contanti',
    category: initialData.category || 'alimentari',
    notes: initialData.notes || '',
    tags: initialData.tags || [],
    items: initialData.items || [],
    image_path: initialData.image_path || '',
    thumbnail_path: initialData.thumbnail_path || '',
    currency: initialData.currency || 'EUR',
  });

  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const confidences = initialData.extraction_confidence || {};

  const isLowConfidence = (field: string) => {
    const val = confidences[field];
    return typeof val === 'number' && val < CONFIDENCE_THRESHOLD;
  };

  const handleChange = (field: keyof Receipt, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.vendor_name?.trim()) {
      newErrors.vendor_name = "Nome esercente obbligatorio";
    }
    if (formData.total_amount === undefined || formData.total_amount === null || isNaN(formData.total_amount)) {
      newErrors.total_amount = "Importo totale obbligatorio";
    }
    if (!formData.receipt_date) {
      newErrors.receipt_date = "Data scontrino obbligatoria";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <form className={styles.container} onSubmit={handleSubmit}>
      {imageUrl && (
        <div className={styles.imagePreviewHeader} onClick={() => setIsZoomOpen(true)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Scontrino acquisito" className={styles.imagePreview} />
          <div className={styles.zoomBadge}>
            <Maximize2 size={14} />
            <span>Ingrandisci</span>
          </div>
        </div>
      )}

      {isZoomOpen && imageUrl && (
        <ImageZoom src={imageUrl} onClose={() => setIsZoomOpen(false)} />
      )}

      {/* SEZIONE 1: DATI GENERALE DOCUMENTO */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <FileText size={20} />
          <h3 className="headline-md">Dati Principali</h3>
        </div>

        <div className={styles.formGrid}>
          <div>
            <label className="input-label" htmlFor="vendor_name">
              Nome Esercente / Negozio *
              {isLowConfidence('vendor_name') && (
                <span className={styles.confidenceBadge}>
                  <AlertTriangle size={14} /> Bassa confidenza
                </span>
              )}
            </label>
            <input
              id="vendor_name"
              type="text"
              className={`input ${isLowConfidence('vendor_name') ? 'input-low-confidence' : ''} ${errors.vendor_name ? 'input-error' : ''}`}
              value={formData.vendor_name || ''}
              onChange={(e) => handleChange('vendor_name', e.target.value)}
              placeholder="Es. Esselunga, Bar Roma..."
              required
            />
            {errors.vendor_name && <p className="label-sm" style={{ color: 'var(--color-error)' }}>{errors.vendor_name}</p>}
          </div>

          <div>
            <label className="input-label" htmlFor="total_amount">
              Importo Totale (€) *
              {isLowConfidence('total_amount') && (
                <span className={styles.confidenceBadge}>
                  <AlertTriangle size={14} /> Bassa confidenza
                </span>
              )}
            </label>
            <input
              id="total_amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              className={`input tabular-nums ${isLowConfidence('total_amount') ? 'input-low-confidence' : ''} ${errors.total_amount ? 'input-error' : ''}`}
              value={formData.total_amount ?? ''}
              onChange={(e) => handleChange('total_amount', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              required
            />
            {errors.total_amount && <p className="label-sm" style={{ color: 'var(--color-error)' }}>{errors.total_amount}</p>}
          </div>

          <div>
            <label className="input-label" htmlFor="receipt_date">
              Data Scontrino *
              {isLowConfidence('receipt_date') && (
                <span className={styles.confidenceBadge}>
                  <AlertTriangle size={14} /> Bassa confidenza
                </span>
              )}
            </label>
            <input
              id="receipt_date"
              type="date"
              className={`input ${isLowConfidence('receipt_date') ? 'input-low-confidence' : ''} ${errors.receipt_date ? 'input-error' : ''}`}
              value={formData.receipt_date || ''}
              onChange={(e) => handleChange('receipt_date', e.target.value)}
              required
            />
          </div>

          <div>
            <label className="input-label" htmlFor="receipt_time">
              Ora
            </label>
            <input
              id="receipt_time"
              type="time"
              className="input"
              value={formData.receipt_time || ''}
              onChange={(e) => handleChange('receipt_time', e.target.value)}
            />
          </div>

          <div>
            <label className="input-label" htmlFor="document_type">
              Tipo Documento
            </label>
            <select
              id="document_type"
              className="input"
              value={formData.document_type || 'scontrino'}
              onChange={(e) => handleChange('document_type', e.target.value)}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="input-label" htmlFor="payment_method">
              Metodo di Pagamento
            </label>
            <select
              id="payment_method"
              className="input"
              value={formData.payment_method || 'contanti'}
              onChange={(e) => handleChange('payment_method', e.target.value)}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="input-label" htmlFor="category">
              Categoria
            </label>
            <select
              id="category"
              className="input"
              value={formData.category || 'alimentari'}
              onChange={(e) => handleChange('category', e.target.value)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="input-label" htmlFor="vat_amount">
              Importo IVA (€)
            </label>
            <input
              id="vat_amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              className="input tabular-nums"
              value={formData.vat_amount ?? ''}
              onChange={(e) => handleChange('vat_amount', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="0.00"
            />
          </div>
        </div>
      </section>

      {/* SEZIONE 2: ARTICOLI */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <ShoppingCart size={20} />
          <h3 className="headline-md">Dettaglio Articoli</h3>
        </div>
        <LineItemsEditor
          items={formData.items || []}
          onChange={(newItems: LineItem[]) => handleChange('items', newItems)}
        />
      </section>

      {/* SEZIONE 3: NOTE E TAG */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <Tag size={20} />
          <h3 className="headline-md">Classificazione & Note</h3>
        </div>

        <div>
          <ChipInput
            label="Tag / Etichette"
            tags={formData.tags || []}
            onChange={(newTags) => handleChange('tags', newTags)}
            placeholder="Scrivi un tag e premi Invio..."
          />
        </div>

        <div style={{ marginTop: '12px' }}>
          <label className="input-label" htmlFor="notes">
            Note Aggiuntive
          </label>
          <textarea
            id="notes"
            className="input"
            rows={3}
            value={formData.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Aggiungi una nota o promemoria..."
            style={{ resize: 'vertical' }}
          />
        </div>
      </section>

      {/* BOTTOM ACTION BAR */}
      <div className={styles.bottomBar}>
        {onReanalyze && (
          <button
            type="button"
            className="btn-secondary"
            onClick={onReanalyze}
            disabled={isSaving}
          >
            <RefreshCw size={18} />
            <span>Rianalizza</span>
          </button>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={isSaving}
        >
          <Check size={18} />
          <span>{isSaving ? 'Salvataggio...' : 'Salva Scontrino'}</span>
        </button>
      </div>
    </form>
  );
}
