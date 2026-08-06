'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { LineItem } from '@/lib/types';
import styles from './LineItemsEditor.module.css';

interface LineItemsEditorProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}

export default function LineItemsEditor({ items, onChange }: LineItemsEditorProps) {
  const handleItemChange = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...items];
    const item = { ...updated[index] };

    if (field === 'description') {
      item.description = String(value);
    } else {
      const numVal = parseFloat(String(value)) || 0;
      if (field === 'quantity') item.quantity = numVal;
      if (field === 'unit_price') item.unit_price = numVal;
      if (field === 'total') item.total = numVal;

      // Calculate total automatically if qty and unit_price are provided
      if ((field === 'quantity' || field === 'unit_price') && item.quantity && item.unit_price) {
        item.total = Number((item.quantity * item.unit_price).toFixed(2));
      }
    }

    updated[index] = item;
    onChange(updated);
  };

  const handleAddItem = () => {
    onChange([...items, { description: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className={styles.wrapper}>
      {items.map((item, index) => (
        <div key={index} className={styles.itemRow}>
          <div>
            <label className="input-label" htmlFor={`item-desc-${index}`}>
              Descrizione
            </label>
            <input
              id={`item-desc-${index}`}
              type="text"
              className="input"
              value={item.description}
              onChange={(e) => handleItemChange(index, 'description', e.target.value)}
              placeholder="Nome articolo"
            />
          </div>

          <div>
            <label className="input-label" htmlFor={`item-qty-${index}`}>
              Q.tà
            </label>
            <input
              id={`item-qty-${index}`}
              type="number"
              inputMode="decimal"
              step="any"
              className="input tabular-nums"
              value={item.quantity ?? 1}
              onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
            />
          </div>

          <div>
            <label className="input-label" htmlFor={`item-tot-${index}`}>
              Totale (€)
            </label>
            <input
              id={`item-tot-${index}`}
              type="number"
              inputMode="decimal"
              step="0.01"
              className="input tabular-nums"
              value={item.total}
              onChange={(e) => handleItemChange(index, 'total', e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div style={{ paddingTop: '24px' }}>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => handleRemoveItem(index)}
              title="Elimina riga"
              aria-label="Elimina articolo"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        className={`btn-secondary ${styles.addBtn}`}
        onClick={handleAddItem}
      >
        <Plus size={18} />
        <span>Aggiungi articolo</span>
      </button>
    </div>
  );
}
