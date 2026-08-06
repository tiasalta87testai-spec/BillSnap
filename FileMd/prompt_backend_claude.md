# BillSnap — Backend, Database, Edge Functions, AI & Infrastruttura (V2 - Multiutente con Ruoli, Gruppi e Backup Cloud)
### Per Antigravity (Claude Sonnet)

> Questo prompt copre **tutto il backend**: architettura, Supabase Edge Functions, schema DB, Storage, Gemini AI, autenticazione, sicurezza, CORS, RLS, ruoli, rate limiting, gestione statistiche e configurazione di backup cloud. Il frontend (UI, componenti, styling) è gestito da un prompt separato.

---

## OBIETTIVO

Implementare il backend completo di una web app mobile-first per acquisire scontrini e ricevute fiscali. Il backend è basato su **Supabase** (Postgres + Edge Functions + Storage + Auth). L'applicazione deve essere multiutente con autenticazione reale (email/password), profilazione dei ruoli (`Admin` e `Operatore`), raggruppamento delle ricevute in gruppi, statistiche utente e una sezione admin per la gestione degli utenti e per configurare il salvataggio automatico (backup) delle immagini su un cloud provider esterno (Google Drive, Dropbox, iCloud, OneDrive).

---

## STACK BACKEND

- **Autenticazione**: Supabase Auth (Email / Password)
- **Edge Functions**: Supabase Edge Functions (Deno runtime)
- **Database**: Supabase Postgres con Row Level Security (RLS) e trigger automatici
- **Storage**: Supabase Storage (bucket privato `receipts-images` + cartelle temporanee/definitive)
- **AI**: Google Gemini 2.5 Flash (`gemini-2.5-flash`), con fallback configurabile a `gemini-2.5-pro`
- **Integrazioni Cloud**: API esterne (Google Drive, Dropbox, OneDrive) per l'archiviazione delle ricevute da parte dell'Admin

---

## SCHEMA DATABASE SUPABASE

### Migration SQL completa

```sql
-- ============================================
-- ENUMS & TIPI
-- ============================================

CREATE TYPE user_role AS ENUM ('Admin', 'Operatore');
CREATE TYPE cloud_provider AS ENUM ('drive', 'dropbox', 'icloud', 'onedrive');
CREATE TYPE doc_type AS ENUM ('scontrino', 'ricevuta_fiscale', 'fattura', 'nota_credito', 'non_ricevuta', 'altro');
CREATE TYPE pay_method AS ENUM ('contanti', 'carta_credito', 'carta_debito', 'bancomat', 'satispay', 'altro');

-- ============================================
-- TABELLA PROFILI & RUOLI
-- ============================================

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  email text NOT NULL,
  first_name text,
  last_name text,
  role user_role NOT NULL DEFAULT 'Operatore'
);

-- ============================================
-- TABELLA GRUPPI RICEVUTE
-- ============================================

CREATE TABLE receipt_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULLABLE,
  color text NULLABLE -- Colore per identificare il gruppo in UI
);

-- ============================================
-- TABELLA RICEVUTE
-- ============================================

CREATE TABLE receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NULLABLE REFERENCES receipt_groups(id) ON DELETE SET NULL,
  
  -- Dati documento
  receipt_date date NOT NULL,
  receipt_time text NULLABLE,
  vendor_name text NOT NULL,
  vendor_vat_number text NULLABLE,
  total_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  vat_amount numeric NULLABLE,
  document_type doc_type NOT NULL DEFAULT 'scontrino',
  receipt_number text NULLABLE,
  payment_method pay_method NULLABLE,
  
  -- Dettaglio articoli
  items jsonb NULLABLE,  -- [{description, quantity, unit_price, total}]
  
  -- Metadati utente
  notes text NULLABLE,
  category text NULLABLE,
  tags jsonb NULLABLE,  -- ["tag1", "tag2"]
  
  -- Immagine
  image_path text NOT NULL,       -- percorso nel bucket Storage
  thumbnail_path text NULLABLE,   -- percorso thumbnail nel bucket Storage
  image_url text NULLABLE,        -- signed URL (temporaneo, rigenerato on-demand)
  
  -- Stato backup cloud
  cloud_sync_status text NOT NULL DEFAULT 'pending', -- pending, synced, failed
  cloud_file_id text NULLABLE,
  cloud_file_url text NULLABLE,
  
  -- Dati AI
  raw_ai_response jsonb NULLABLE,       -- risposta grezza Gemini per debug
  raw_text text NULLABLE,               -- testo OCR estratto
  extraction_confidence jsonb NULLABLE, -- {receipt_date: 0.9, vendor_name: 0.7, ...}
  
  status text NOT NULL DEFAULT 'saved'  -- saved, draft, deleted
);

-- ============================================
-- TABELLA IMPOSTAZIONI CLOUD (SYSTEM-WIDE)
-- ============================================

CREATE TABLE cloud_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  provider cloud_provider NOT NULL,
  credentials jsonb NOT NULL, -- credenziali/token cifrati o di accesso OAuth
  backup_path text NOT NULL DEFAULT '/BillSnap/Receipts', -- percorso di salvataggio
  is_active boolean NOT NULL DEFAULT false
);

-- ============================================
-- TRIGGER UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_groups BEFORE UPDATE ON receipt_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_receipts BEFORE UPDATE ON receipts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_cloud_settings BEFORE UPDATE ON cloud_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- TRIGGER AUTOMATICO CREAZIONE PROFILO DA AUTH
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_first_user boolean;
BEGIN
  -- Se è il primo utente registrato nel sistema, lo impostiamo come Admin
  SELECT NOT EXISTS (SELECT 1 FROM profiles) INTO is_first_user;
  
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    CASE WHEN is_first_user THEN 'Admin'::user_role ELSE 'Operatore'::user_role END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- INDICI E OTTIMIZZAZIONI
-- ============================================

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_receipts_user_group ON receipts(user_id, group_id);
CREATE INDEX idx_receipts_date ON receipts(receipt_date DESC);
CREATE INDEX idx_receipts_vendor ON receipts USING gin(to_tsvector('italian', coalesce(vendor_name, '')));
CREATE INDEX idx_receipt_groups_user ON receipt_groups(user_id);
CREATE INDEX idx_receipts_duplicate_check ON receipts(receipt_date, vendor_name, total_amount, user_id) WHERE status != 'deleted';

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_settings ENABLE ROW LEVEL SECURITY;

-- Funzione helper per verificare se l'utente corrente è Admin
CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'Admin'::user_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Policies per PROFILI
CREATE POLICY "Profili leggibili da utenti autenticati" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Profili modificabili solo da Admin o se stessi" ON profiles
  FOR UPDATE USING (auth.uid() = id OR current_user_is_admin());

CREATE POLICY "Profili eliminabili solo da Admin" ON profiles
  FOR DELETE USING (current_user_is_admin());

-- 2. Policies per GRUPPI RICEVUTE
CREATE POLICY "Gruppi accessibili solo al proprietario" ON receipt_groups
  FOR ALL USING (auth.uid() = user_id);

-- 3. Policies per RICEVUTE
CREATE POLICY "Ricevute accessibili solo al proprietario o agli Admin" ON receipts
  FOR ALL USING (auth.uid() = user_id OR current_user_is_admin());

-- 4. Policies per CLOUD SETTINGS (Solo Admin)
CREATE POLICY "Cloud settings accessibili solo agli Admin" ON cloud_settings
  FOR ALL USING (current_user_is_admin());
```

---

## EDGE FUNCTIONS DA CREARE O AGGIORNARE

Ogni chiamata alle Edge Functions deve ora **validare l'autenticazione tramite JWT token** (header `Authorization: Bearer <token>`). La Service Role Key viene usata solo per bypassare le RLS dove necessario o per operare su `auth.users` come Admin.

### 1) `admin-manage-users` (Solo per utenti con ruolo `Admin`)
- **Azioni**: 
  - Ottiene la lista di tutti gli utenti (`profiles` + metadati di autenticazione da `auth.users`).
  - Aggiorna il ruolo di un utente (`profiles.role` -> `Admin` o `Operatore`).
  - Elimina o sospende un utente.
- **Sicurezza**: Rifiuta la richiesta se l'utente non ha ruolo `Admin` (utilizzando la funzione helper `current_user_is_admin()` o controllando direttamente il database).

### 2) `save-receipt` (Aggiornata per Backup Cloud)
- **Input**: `{ image_path, group_id, ...dati_confermati }`
- **Azioni**: 
  - Salva la ricevuta sul database associando l'utente loggato (`user_id = auth.uid()`).
  - **Integrazione Cloud**: Se è configurato un cloud provider attivo in `cloud_settings`, attiva un processo di backup (anche asincrono via Deno background promise o sincrono prima della risposta) per caricare l'immagine al percorso configurato (es. `{backup_path}/user_{id}/{anno}/{mese}/{vendor}_{data}.jpg`).
  - Aggiorna lo stato `cloud_sync_status` e i riferimenti sul DB.

### 3) `backup-to-cloud` (Nuova Edge Function o modulo integrato)
- **Input**: `{ receipt_id }`
- **Azioni**:
  - Legge le impostazioni in `cloud_settings` e scarica il file da Supabase Storage.
  - Carica il file sul rispettivo provider (Drive, Dropbox, OneDrive, iCloud) utilizzando le relative API OAuth2.
  - Ritorna l'URL del file caricato sul cloud.

### 4) `get-user-stats` (Nuova Edge Function per Statistiche)
- **Input**: Filtri temporali (opzionale `{ start_date, end_date }`)
- **Azioni**:
  - Restituisce statistiche aggregate per l'utente corrente (`auth.uid()`):
    1. Spesa totale cumulativa.
    2. Spesa media per scontrino.
    3. Spesa suddivisa per Categoria (alimentari, ristorazione, ecc.).
    4. Spesa suddivisa per Gruppo (`group_id`).
    5. Distribuzione mensile delle spese nell'ultimo anno.
    6. Conteggio totale delle ricevute inserite.

---

## STRUTTURA DELLE STATISTICHE (JSON di output per `get-user-stats`)

L'Edge Function deve produrre una risposta JSON formattata così:
```json
{
  "total_spent": 1250.45,
  "average_amount": 34.73,
  "receipts_count": 36,
  "by_category": [
    { "category": "ristorazione", "amount": 420.50, "percentage": 33.6 },
    { "category": "alimentari", "amount": 310.20, "percentage": 24.8 }
  ],
  "by_group": [
    { "group_id": "uuid-1", "group_name": "Trasferta Milano", "amount": 550.00 },
    { "group_id": "uuid-2", "group_name": "Spese Ufficio", "amount": 120.45 }
  ],
  "monthly_trend": [
    { "month": "2026-06", "amount": 340.00, "count": 12 },
    { "month": "2026-07", "amount": 510.45, "count": 15 }
  ]
}
```

---

## LOGICA DI INTEGRAZIONE CLOUD PROVIDER (API)

L'Edge Function deve contenere driver minimi per interagire con i provider configurati:

- **Google Drive**: `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`
- **Dropbox**: `POST https://content.dropboxapi.com/2/files/upload`
- **OneDrive**: `PUT https://graph.microsoft.com/v1.0/me/drive/root:/{path}:/content`

Le credenziali devono memorizzare:
```json
{
  "access_token": "ya29...",
  "refresh_token": "1//0...",
  "client_id": "...",
  "client_secret": "...",
  "expires_at": "2026-08-05T22:24:08Z"
}
```
L'Edge Function si occuperà di fare il refresh del token prima di caricare l'immagine se il token è scaduto.

---

## VINCOLI E REGOLE DI SICUREZZA PER CLAUDE

1. **Gestione del JWT Token**: Qualsiasi operazione deve validare l'identità dell'utente usando la funzione `supabase.auth.getUser(token)` fornita dall'header `Authorization`.
2. **Accesso Amministratore**: La modifica dei ruoli o la lettura di `cloud_settings` e della lista utenti completa deve rigorosamente controllare che `profile.role === 'Admin'`.
3. **Gestione Errori**: Se l'upload sul cloud fallisce, il salvataggio su Supabase **non deve bloccarsi**. La ricevuta deve essere salvata comunque, impostando `cloud_sync_status = 'failed'`. L'applicazione deve consentire all'utente di riprovare il backup in un secondo momento.
4. **Isolamento dei Dati**: Le RLS su Postgres garantiscono che gli operatori vedano solo le proprie ricevute e i propri gruppi. Claude deve assicurarsi che l'SQL e i trigger rispettino questo isolamento a livello di DB.
