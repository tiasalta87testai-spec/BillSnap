-- ============================================================
-- BillSnap — Migration iniziale
-- Progetto: billsnap (kkuitfbewuxrkysvvxyz)
-- ============================================================


-- ============================================================
-- TABELLA RECEIPTS
-- ============================================================

CREATE TABLE receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  user_id uuid NULLABLE,  -- FK verso auth.users (per futuro multiutente)

  -- Dati documento
  receipt_date date,
  receipt_time text,
  vendor_name text,
  vendor_vat_number text NULLABLE,
  total_amount numeric,
  currency text NOT NULL DEFAULT 'EUR',
  vat_amount numeric NULLABLE,
  document_type text,  -- scontrino | ricevuta_fiscale | fattura | nota_credito | non_ricevuta | altro
  receipt_number text NULLABLE,
  payment_method text NULLABLE,  -- contanti | carta_credito | carta_debito | bancomat | satispay | altro

  -- Dettaglio articoli
  items jsonb NULLABLE,  -- [{description, quantity, unit_price, total}]

  -- Metadati utente
  notes text NULLABLE,
  category text NULLABLE,  -- alimentari | trasporti | ufficio | ristorazione | salute | abbigliamento | altro
  tags jsonb NULLABLE,     -- ["tag1", "tag2"]

  -- Immagine
  image_path text NOT NULL,       -- percorso relativo nel bucket receipts-images
  thumbnail_path text NULLABLE,   -- percorso thumbnail nel bucket receipts-images
  image_url text NULLABLE,        -- signed URL temporaneo (rigenerato on-demand)

  -- Dati AI
  raw_ai_response jsonb NULLABLE,       -- risposta grezza Gemini per debug
  raw_text text NULLABLE,               -- testo OCR estratto
  extraction_confidence jsonb NULLABLE, -- {receipt_date: 0.9, vendor_name: 0.7, ...}

  -- Stato
  status text NOT NULL DEFAULT 'saved'  -- saved | draft | deleted
);

-- Commenti
COMMENT ON TABLE receipts IS 'Scontrini e ricevute fiscali acquisiti tramite AI';
COMMENT ON COLUMN receipts.items IS 'Array JSON: [{description, quantity, unit_price, total}]';
COMMENT ON COLUMN receipts.tags IS 'Array JSON di stringhe tag';
COMMENT ON COLUMN receipts.image_path IS 'Percorso relativo nel bucket receipts-images';
COMMENT ON COLUMN receipts.extraction_confidence IS 'Score 0.0-1.0 per campo, restituito da Gemini';
COMMENT ON COLUMN receipts.status IS 'Valori: saved (default), draft, deleted';


-- ============================================================
-- TRIGGER UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- INDICI
-- ============================================================

-- Query principale storico (per utente, ordinata per data)
CREATE INDEX idx_receipts_user_date ON receipts(user_id, receipt_date DESC);

-- Ricerca full-text vendor name (italiano)
CREATE INDEX idx_receipts_vendor_fts ON receipts
  USING gin(to_tsvector('italian', coalesce(vendor_name, '')));

-- Filtro per stato (esclude deleted)
CREATE INDEX idx_receipts_status ON receipts(status)
  WHERE status != 'deleted';

-- Ordinamento per data creazione
CREATE INDEX idx_receipts_created ON receipts(created_at DESC);

-- Check duplicati (data + vendor + importo, esclude deleted)
CREATE INDEX idx_receipts_duplicate_check ON receipts(receipt_date, vendor_name, total_amount)
  WHERE status != 'deleted';


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- FASE 1: Mono-utente — anon key può tutto
-- Rimuovere questa policy quando si attiva l'autenticazione
CREATE POLICY "anon_full_access" ON receipts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- FASE 2: Multiutente — decommentare e fare DROP della policy sopra
-- DROP POLICY "anon_full_access" ON receipts;
--
-- CREATE POLICY "users_select_own" ON receipts
--   FOR SELECT USING (auth.uid() = user_id);
--
-- CREATE POLICY "users_insert_own" ON receipts
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "users_update_own" ON receipts
--   FOR UPDATE USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "users_delete_own" ON receipts
--   FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- TABELLA RATE LIMITS
-- ============================================================

CREATE TABLE rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_address text NOT NULL,
  function_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE rate_limits IS 'Rate limiting per Edge Functions, basato su IP e nome funzione';

-- Indice per query veloci
CREATE INDEX idx_rate_limits_lookup ON rate_limits(ip_address, function_name, created_at DESC);

-- RLS: la tabella è accessibile solo via service role (da Edge Functions)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON rate_limits
  FOR ALL
  USING (false)
  WITH CHECK (false);
-- Le Edge Functions usano SERVICE_ROLE_KEY che bypassa RLS


-- ============================================================
-- STORAGE BUCKET (istruzioni)
-- ============================================================
-- Creare manualmente dalla dashboard Supabase > Storage, oppure via CLI:
--
--   supabase storage create receipts-images --public=false
--
-- Configurazione:
--   Nome:             receipts-images
--   Visibilità:       PRIVATO (non pubblico)
--   Max file size:    5 MB
--   Allowed MIME:     image/jpeg, image/png, image/webp
