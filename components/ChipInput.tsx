'use client';

import React, { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import styles from './ChipInput.module.css';

interface ChipInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  label?: string;
}

export default function ChipInput({ tags, onChange, placeholder = 'Aggiungi tag...', label }: ChipInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = inputValue.trim().replace(/^#/, '');
      if (trimmed && !tags.includes(trimmed)) {
        onChange([...tags, trimmed]);
        setInputValue('');
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const handleRemove = (indexToRemove: number) => {
    onChange(tags.filter((_, i) => i !== indexToRemove));
  };

  return (
    <div className={styles.container}>
      {label && <label className="input-label">{label}</label>}
      <div className={styles.chipsWrapper}>
        {tags.map((tag, index) => (
          <span key={index} className={styles.chip}>
            #{tag}
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => handleRemove(index)}
              aria-label={`Rimuovi tag ${tag}`}
            >
              <X size={14} />
            </button>
          </span>
        ))}
        <input
          type="text"
          className={styles.input}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
        />
      </div>
    </div>
  );
}
