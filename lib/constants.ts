import { DocumentType, PaymentMethod, ReceiptCategory } from './types';

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'scontrino', label: 'Scontrino' },
  { value: 'ricevuta_fiscale', label: 'Ricevuta Fiscale' },
  { value: 'fattura', label: 'Fattura' },
  { value: 'nota_credito', label: 'Nota di Credito' },
  { value: 'altro', label: 'Altro' },
];

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'contanti', label: 'Contanti' },
  { value: 'carta_credito', label: 'Carta di Credito' },
  { value: 'carta_debito', label: 'Carta di Debito' },
  { value: 'bancomat', label: 'Bancomat' },
  { value: 'satispay', label: 'Satispay' },
  { value: 'altro', label: 'Altro' },
];

export const CATEGORIES: { value: ReceiptCategory; label: string; iconName: string }[] = [
  { value: 'alimentari', label: 'Alimentari', iconName: 'ShoppingBag' },
  { value: 'ristorazione', label: 'Ristorazione', iconName: 'Utensils' },
  { value: 'trasporti', label: 'Trasporti', iconName: 'Car' },
  { value: 'ufficio', label: 'Ufficio & Lavoro', iconName: 'Briefcase' },
  { value: 'salute', label: 'Salute & Benessere', iconName: 'Heart' },
  { value: 'abbigliamento', label: 'Abbigliamento', iconName: 'Shirt' },
  { value: 'altro', label: 'Altro', iconName: 'Tag' },
];

export const CONFIDENCE_THRESHOLD = 0.6;
