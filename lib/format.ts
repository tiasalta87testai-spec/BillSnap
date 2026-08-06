export function formatCurrency(amount: number | null | undefined, currency: string = 'EUR'): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0,00 €';
  }
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Data non specificata';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatLabel(key: string): string {
  const map: Record<string, string> = {
    scontrino: 'Scontrino',
    ricevuta_fiscale: 'Ricevuta Fiscale',
    fattura: 'Fattura',
    nota_credito: 'Nota di Credito',
    contanti: 'Contanti',
    carta_credito: 'Carta di Credito',
    carta_debito: 'Carta di Debito',
    bancomat: 'Bancomat',
    satispay: 'Satispay',
    alimentari: 'Alimentari',
    ristorazione: 'Ristorazione',
    trasporti: 'Trasporti',
    ufficio: 'Ufficio',
    salute: 'Salute',
    abbigliamento: 'Abbigliamento',
    altro: 'Altro',
  };
  return map[key] || key;
}
