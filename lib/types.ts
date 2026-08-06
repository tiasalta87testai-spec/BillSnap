export type DocumentType =
  | 'scontrino'
  | 'ricevuta_fiscale'
  | 'fattura'
  | 'nota_credito'
  | 'non_ricevuta'
  | 'altro';

export type PaymentMethod =
  | 'contanti'
  | 'carta_credito'
  | 'carta_debito'
  | 'bancomat'
  | 'satispay'
  | 'altro';

export type ReceiptCategory =
  | 'alimentari'
  | 'trasporti'
  | 'ufficio'
  | 'ristorazione'
  | 'salute'
  | 'abbigliamento'
  | 'altro';

export type ReceiptStatus = 'saved' | 'draft' | 'deleted';
export type UserRole = 'Admin' | 'Operatore';

export interface UserProfile {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role: UserRole;
  created_at: string;
  updated_at?: string | null;
}

export interface ReceiptGroup {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  created_at: string;
}

export interface LineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  total: number;
}

export interface ExtractionConfidence {
  receipt_date?: number;
  vendor_name?: number;
  total_amount?: number;
  vat_amount?: number;
  document_type?: number;
  receipt_number?: number;
  payment_method?: number;
  items?: number;
  category?: number;
  [key: string]: number | undefined;
}

export interface Receipt {
  id: string;
  created_at: string;
  updated_at?: string;
  user_id?: string | null;
  group_id?: string | null;
  receipt_date?: string | null;
  receipt_time?: string | null;
  vendor_name?: string | null;
  vendor_vat_number?: string | null;
  total_amount?: number | null;
  currency: string;
  vat_amount?: number | null;
  document_type?: DocumentType | string | null;
  receipt_number?: string | null;
  payment_method?: PaymentMethod | string | null;
  items?: LineItem[] | null;
  notes?: string | null;
  category?: ReceiptCategory | string | null;
  tags?: string[] | null;
  image_path: string;
  thumbnail_path?: string | null;
  image_url?: string | null;
  cloud_sync_status?: 'pending' | 'synced' | 'failed';
  raw_ai_response?: Record<string, unknown> | null;
  raw_text?: string | null;
  extraction_confidence?: ExtractionConfidence | null;
  status: ReceiptStatus;
}

export interface ProcessedImage {
  file: File;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface FilterOptions {
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
  documentType?: string;
  groupId?: string;
}

export interface UserStats {
  total_spending: number;
  average_spending: number;
  total_receipts: number;
  category_spending: Array<{ category: string; total: number; count: number }>;
  group_spending: Array<{ group_id: string | null; group_name: string; color: string | null; total: number; count: number }>;
  monthly_trends: Array<{ month: string; total: number; count: number }>;
}
