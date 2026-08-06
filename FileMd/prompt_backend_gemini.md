# BillSnap — Backend, Database, Edge Functions, AI & Infrastruttura (V2 - Ottimizzato per Gemini)
### Per Antigravity (Gemini 3.5 / 3.6)

> Questo prompt copre **tutto il backend**: database, tabelle, trigger, RLS policies, Deno Edge Functions, Storage, integrazione Gemini AI, rate limiting, autenticazione multiutente e backup su cloud esterni (Google Drive, Dropbox, OneDrive, iCloud). Il frontend (UI, styling, componenti) è gestito da un prompt separato.

---

## OBIETTIVO

Sviluppare l'infrastruttura backend completa di una web app mobile-first per l'acquisizione, l'analisi e il salvataggio di scontrini fiscali. Tutto deve essere basato sull'ecosistema **Supabase** (Postgres + Edge Functions + Storage + Auth). L'applicazione deve essere multiutente con autenticazione reale (email/password), profilazione dei ruoli (`Admin` e `Operatore`), raggruppamento delle ricevute in gruppi, statistiche utente e una sezione admin per configurare il salvataggio automatico (backup) delle immagini su un cloud provider esterno (Google Drive, Dropbox, OneDrive, iCloud).

---

## ARCHITETTURA DI RIFERIMENTO

```
   [ Next.js Frontend (Vercel) ]
                 │
                 │ Chiamate HTTPS + JWT User Auth
                 ▼
┌────────────────────────────────────────────────────────┐
│  SUPABASE EDGE FUNCTIONS (Deno)                        │
│                                                        │
│  - upload-image      → Carica su Supabase Storage      │
│  - analyze-receipt   → Legge file e invia a Gemini API │
│  - save-receipt      → Controlla duplicati e salva DB  │
│  - delete-receipt    → Elimina DB e file Storage        │
│  - get-signed-url    → Genera signed URL temporanei    │
│  - get-user-stats    → Calcola statistiche aggregate   │
│  - admin-manage-users→ Gestione utenti e ruoli (Admin) │
│                                                        │
│  (CORS, Rate Limiting, JWT Verification in ogni EF)   │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────┐
│  SUPABASE DATABASE & STORAGE                           │
│                                                        │
│  Tabelle:                                              │
│  - profiles (Ruoli, dati base utenti)                  │
│  - receipt_groups (Faldoni di spesa)                   │
│  - receipts (Dati estratti, image_path, sync status)   │
│  - cloud_settings (Configurazione backup, solo Admin)   │
│  - rate_limits (Tracciamento IP per rate limiting)     │
│                                                        │
│  Storage: Bucket privato "receipts-images"             │
└────────────────────────────────────────────────────────┘
```

---

## SCHEMA DATABASE (PostgreSQL Migration)

Crea ed esegui la seguente migration per configurare il database Postgres su Supabase:

```sql
-- Abilita estensione UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  description text,
  color text
);

-- ============================================
-- TABELLA RICEVUTE
-- ============================================
CREATE TABLE receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES receipt_groups(id) ON DELETE SET NULL,
  
  -- Dati documento
  receipt_date date NOT NULL,
  receipt_time text,
  vendor_name text NOT NULL,
  vendor_vat_number text,
  total_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  vat_amount numeric,
  document_type doc_type NOT NULL DEFAULT 'scontrino',
  receipt_number text,
  payment_method pay_method,
  
  -- Dettaglio articoli
  items jsonb,  -- [{description, quantity, unit_price, total}]
  
  -- Metadati utente
  notes text,
  category text,
  tags jsonb,  -- ["tag1", "tag2"]
  
  -- Immagine
  image_path text NOT NULL,       -- percorso nel bucket Storage
  thumbnail_path text,            -- percorso thumbnail nel bucket Storage
  image_url text,                 -- signed URL (temporaneo, rigenerato on-demand)
  
  -- Stato backup cloud
  cloud_sync_status text NOT NULL DEFAULT 'pending', -- pending, synced, failed
  cloud_file_id text,
  cloud_file_url text,
  
  -- Dati AI
  raw_ai_response jsonb,
  raw_text text,
  extraction_confidence jsonb,
  
  status text NOT NULL DEFAULT 'saved'
);

-- ============================================
-- TABELLA IMPOSTAZIONI CLOUD (SOLO ADMIN)
-- ============================================
CREATE TABLE cloud_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  provider cloud_provider NOT NULL,
  credentials jsonb NOT NULL, -- credenziali/token OAuth2
  backup_path text NOT NULL DEFAULT '/BillSnap/Receipts',
  is_active boolean NOT NULL DEFAULT false
);

-- ============================================
-- TABELLA RATE LIMITING
-- ============================================
CREATE TABLE rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_address text NOT NULL,
  function_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- TRIGGER: UPDATED_AT
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
-- TRIGGER: CREAZIONE PROFILO DA AUTH
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_first_user boolean;
BEGIN
  -- Se è il primo utente registrato in assoluto, assegna il ruolo di Admin
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
-- INDICI
-- ============================================
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_receipts_user_group ON receipts(user_id, group_id);
CREATE INDEX idx_receipts_date ON receipts(receipt_date DESC);
CREATE INDEX idx_receipts_vendor ON receipts USING gin(to_tsvector('italian', coalesce(vendor_name, '')));
CREATE INDEX idx_receipt_groups_user ON receipt_groups(user_id);
CREATE INDEX idx_receipts_duplicate_check ON receipts(receipt_date, vendor_name, total_amount, user_id) WHERE status != 'deleted';
CREATE INDEX idx_rate_limits_lookup ON rate_limits(ip_address, function_name, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_settings ENABLE ROW LEVEL SECURITY;

-- Helper per verificare se l'utente loggato è Admin
CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'Admin'::user_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies per PROFILI
CREATE POLICY "Profili leggibili da utenti autenticati" ON profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Profili modificabili da se stessi o da Admin" ON profiles FOR UPDATE USING (auth.uid() = id OR current_user_is_admin());
CREATE POLICY "Profili eliminabili solo da Admin" ON profiles FOR DELETE USING (current_user_is_admin());

-- Policies per GRUPPI RICEVUTE
CREATE POLICY "Gruppi accessibili solo al proprietario" ON receipt_groups FOR ALL USING (auth.uid() = user_id);

-- Policies per RICEVUTE
CREATE POLICY "Ricevute accessibili al proprietario o agli Admin" ON receipts FOR ALL USING (auth.uid() = user_id OR current_user_is_admin());

-- Policies per CLOUD SETTINGS (Solo Admin)
CREATE POLICY "Cloud settings accessibili solo agli Admin" ON cloud_settings FOR ALL USING (current_user_is_admin());
```

---

## EDGE FUNCTIONS — CODICE COMPLETO (DENO / SUPABASE CLI)

Crea i file all'interno della directory `supabase/functions/` del tuo progetto:

### File condivisi (`_shared/`)

#### 📂 `supabase/functions/_shared/cors.ts`
```typescript
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(o => o.trim());

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const isAllowed = allowedOrigins.includes(origin) || allowedOrigins.includes('*');
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0] || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  return null;
}
```

#### 📂 `supabase/functions/_shared/supabase.ts`
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

export function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );
}

// Verifica la sessione dell'utente autenticato a partire dall'header Authorization
export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Token di autenticazione mancante');
  }
  
  const token = authHeader.split(' ')[1];
  const supabase = getServiceClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Token non valido o sessione scaduta');
  }
  return user;
}
```

#### 📂 `supabase/functions/_shared/response.ts`
```typescript
import { getCorsHeaders } from './cors.ts';

export function jsonResponse(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

export function errorResponse(req: Request, message: string, status = 400): Response {
  return jsonResponse(req, { error: true, message }, status);
}
```

#### 📂 `supabase/functions/_shared/rate-limit.ts`
```typescript
import { getServiceClient } from './supabase.ts';

const LIMITS: Record<string, number> = {
  'upload-image': 20,
  'analyze-receipt': 10,
  'save-receipt': 30,
  'delete-receipt': 10,
  'get-signed-url': 60,
  'get-user-stats': 30,
};

export async function checkRateLimit(req: Request, functionName: string): Promise<boolean> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
          || req.headers.get('cf-connecting-ip') 
          || 'unknown';

  const limit = LIMITS[functionName] || 30;
  const supabase = getServiceClient();
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

  const { count } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .eq('function_name', functionName)
    .gte('created_at', oneMinuteAgo);

  if ((count || 0) >= limit) {
    return false;
  }

  await supabase
    .from('rate_limits')
    .insert({ ip_address: ip, function_name: functionName });

  return true;
}
```

---

### 1) Edge Function `upload-image`
- **Scopo**: Riceve l'immagine in multipart/form-data dal frontend, valida dimensione/estensione e la carica sul bucket privato.
- **Percorso**: `supabase/functions/upload-image/index.ts`

**Requisiti logici**:
- Richiede autenticazione utente.
- Valida il MIME type (accetta `image/jpeg`, `image/png`, `image/webp`).
- Dimensione massima: 5 MB.
- Genera il path usando l'anno, il mese e l'UUID dell'utente loggato: `{user_id}/{anno}/{mese}/{uuid}.jpg`.

---

### 2) Edge Function `analyze-receipt`
- **Scopo**: Legge un'immagine dal bucket di Storage Supabase e la invia alle API di Gemini.
- **Modello AI**: `gemini-2.5-flash`
- **Percorso**: `supabase/functions/analyze-receipt/index.ts`

**Prompt per Gemini**:
```
Sei un sistema di estrazione dati da scontrini e ricevute fiscali italiane.
Analizza l'immagine allegata ed estrai i dati richiesti.

REGOLE FONDAMENTALI:
1. Restituisci ESCLUSIVAMENTE un oggetto JSON valido, senza markdown, senza commenti, senza testo aggiuntivo, senza wrapper ```json.
2. Se un campo non è leggibile o non presente, usa null per i numeri e stringa vuota "" per i testi.
3. NON inventare mai dati. Se non sei sicuro, metti null e confidence bassa.
4. Se l'immagine non è uno scontrino/ricevuta, imposta document_type su "non_ricevuta" e tutti gli altri campi a null/vuoto.
5. Data in formato YYYY-MM-DD, ora in formato HH:MM.
6. Importi numerici puliti (es. 12.50, non "€12,50"). Converti virgola decimale italiana in punto.
7. Valuta come codice ISO a 3 lettere (EUR, USD, ecc.).
8. Per il campo confidence, assegna un valore da 0.0 a 1.0 per ogni campo chiave.

Schema JSON richiesto:
{
  "receipt_date": "YYYY-MM-DD",
  "receipt_time": "HH:MM",
  "vendor_name": "",
  "vendor_vat_number": "",
  "total_amount": 0.00,
  "currency": "EUR",
  "vat_amount": 0.00,
  "document_type": "scontrino|ricevuta_fiscale|fattura|nota_credito|non_ricevuta|altro",
  "receipt_number": "",
  "payment_method": "contanti|carta_credito|carta_debito|bancomat|satispay|altro",
  "items": [
    {
      "description": "nome articolo",
      "quantity": 1,
      "unit_price": 0.00,
      "total": 0.00
    }
  ],
  "raw_text": "Trascrizione di tutto il testo",
  "confidence": {
    "receipt_date": 0.0,
    "receipt_time": 0.0,
    "vendor_name": 0.0,
    "total_amount": 0.0,
    "items": 0.0
  }
}
```

---

### 3) Edge Function `save-receipt`
- **Scopo**: Salva definitivamente il record nel database Supabase.
- **Percorso**: `supabase/functions/save-receipt/index.ts`

**Requisiti logici**:
- Associa il record all'ID dell'utente autenticato.
- Valida la presenza di `receipt_date`, `vendor_name`, `total_amount`, `image_path`.
- Se non è presente il parametro `force_save: true`, controlla se esiste già uno scontrino con stessa data, merchant e totale per lo stesso utente. In tal caso ritorna un warning duplicato `{ is_duplicate_warning: true, existing_id: "..." }`.
- Se è configurato un cloud provider in `cloud_settings`, esegue in background il salvataggio ridondato su cloud esterno (Drive, Dropbox, OneDrive, iCloud) e aggiorna lo stato a `synced` o `failed`.

---

### 4) Edge Function `get-user-stats`
- **Scopo**: Elabora i dati delle ricevute dell'utente per visualizzare statistiche aggregate.
- **Percorso**: `supabase/functions/get-user-stats/index.ts`

**Output atteso**:
Aggregati calcolati sul database Postgres tramite query SQL:
1. Spesa totale e spesa media.
2. Numero totale di ricevute.
3. Raggruppamento spesa totale per Categoria.
4. Raggruppamento spesa totale per Gruppo (`group_id` / `name`).
5. Andamento mensile delle spese (ultimi 12 mesi).

---

### 5) Edge Function `admin-manage-users` (Riservato Admin)
- **Scopo**: Consente agli amministratori del sistema di gestire gli utenti e cambiare i ruoli.
- **Percorso**: `supabase/functions/admin-manage-users/index.ts`

**Requisiti logici**:
- Esegue una query preventiva sulla tabella `profiles` verificando che l'utente loggato (`auth.uid()`) abbia ruolo `'Admin'`. Se non è Admin, ritorna errore `403 Forbidden`.
- Permette di elencare tutti gli utenti del sistema unendo `profiles` e metadati di `auth.users`.
- Permette di modificare il ruolo di un utente (`Admin` / `Operatore`).

---

### 6) Edge Function `delete-receipt`
- **Scopo**: Rimuove la ricevuta dal database ed elimina i file fisici dal bucket Supabase Storage.
- **Percorso**: `supabase/functions/delete-receipt/index.ts`

---

## REGOLE E VINCOLI PER IL DEPLOYMENT

1. **Sicurezza delle API Key**: Nessuna chiave di servizio (`SERVICE_ROLE_KEY`) o API key di Gemini deve essere incorporata nel codice. Usa sempre `Deno.env.get()`.
2. **Rate Limiting**: Usa l'utilità in `_shared/rate-limit.ts` all'inizio di ogni funzione per tracciare e bloccare abusi.
3. **CORS Headers**: Ogni risposta deve includere gli header CORS definiti in `_shared/cors.ts` per evitare di bloccare le richieste provenienti dall'app Next.js su Vercel.
4. **Isolamento dei Dati (Tenant Isolation)**: Non eseguire mai operazioni basandoti sull'ID utente inviato nel body JSON. Estrai sempre l'utente autenticato dall'header HTTP `Authorization` tramite `getAuthenticatedUser(req)` e usa il suo ID (`user.id`) come chiave primaria per tutte le query ed inserimenti.
