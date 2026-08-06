# BillSnap — Prompt Completo Migliorato

Crea una web app mobile-first per acquisire scontrini e ricevute fiscali tramite fotocamera o upload immagine, analizzarli con AI (Gemini), permettere revisione/modifica dei dati estratti e salvare tutto su Supabase. L'app deve essere semplice, veloce e ottimizzata prima di tutto per smartphone.

---

## STACK TECNOLOGICO

- **Frontend**: Next.js 14+ (App Router) pubblicato su Vercel, mobile-first, responsive
- **Backend**: logica server-side gestita tramite Supabase Edge Functions (Deno), non tramite un server Node.js tradizionale né workflow esterni
- **Database**: Supabase (Postgres) con Row Level Security abilitata su tutte le tabelle
- **AI**: Gemini 2.5 Flash (modello `gemini-2.5-flash`) richiamato esclusivamente da Edge Function, mai dal frontend, per non esporre la API key. Possibilità di upgrade a `gemini-2.5-pro` per documenti complessi tramite variabile d'ambiente
- **Storage immagini**: Supabase Storage (bucket dedicato `receipts-images`), NON Google Drive, per restare interamente nell'ecosistema Supabase e semplificare sicurezza, permessi e link firmati
- **Autenticazione**: predisposta con Supabase Auth (anche se inizialmente può restare opzionale/mono-utente), con RLS pronta per essere attivata in futuro
- **Styling**: CSS Modules o Vanilla CSS, design system coerente con variabili CSS custom
- **Librerie frontend consigliate**: browser-image-compression (compressione client-side), heic2any (conversione HEIC)

---

## VARIABILI D'AMBIENTE

### Frontend (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### Supabase Edge Functions (secrets)
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash
ALLOWED_ORIGINS=https://billsnap.vercel.app,http://localhost:3000
```

---

## ARCHITETTURA GENERALE

```
┌─────────────────────────────────────────────────────────┐
│  SMARTPHONE (Browser / PWA)                             │
│  Next.js Frontend su Vercel                             │
│  - Acquisizione immagine (camera/gallery)                │
│  - Compressione client-side (< 1 MB)                    │
│  - Conversione HEIC → JPEG                              │
│  - Preview, revisione dati, storico                     │
│  - Usa solo NEXT_PUBLIC_SUPABASE_ANON_KEY               │
└──────────────┬──────────────────────────────────────────┘
               │ HTTPS (CORS configurato)
               ▼
┌─────────────────────────────────────────────────────────┐
│  SUPABASE EDGE FUNCTIONS (Deno)                         │
│                                                         │
│  1. upload-image     → Storage upload + restituisce     │
│                        image_path                       │
│  2. analyze-receipt  → legge immagine da Storage,       │
│                        chiama Gemini, restituisce JSON   │
│  3. save-receipt     → salva record DB con image_path   │
│                        (nessun re-upload immagine)       │
│  4. delete-receipt   → elimina record + file Storage    │
│                                                         │
│  Usa: SERVICE_ROLE_KEY, GEMINI_API_KEY                  │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│  SUPABASE                                               │
│  - Postgres (tabella receipts + RLS)                    │
│  - Storage (bucket receipts-images)                     │
│  - Auth (predisposta)                                   │
└─────────────────────────────────────────────────────────┘
```

---

## FLUSSO GENERALE (OTTIMIZZATO — UPLOAD SINGOLO)

Il flusso è ottimizzato per **inviare l'immagine una sola volta**, evitando doppio upload su rete mobile.

### Step 1 — Acquisizione
L'utente scatta una foto allo scontrino o carica un'immagine da smartphone.

### Step 2 — Preprocessing client-side
Il frontend:
- converte HEIC → JPEG se necessario
- ridimensiona a max 1920px sul lato lungo
- comprime a qualità JPEG 80-85% (target < 1 MB)
- mostra preview dell'immagine compressa

### Step 3 — Upload immagine
Il frontend invia l'immagine compressa alla Edge Function `upload-image`.
La Edge Function:
- valida formato (jpg, png, webp) e dimensione (max 5 MB)
- genera un nome file univoco con struttura ordinata: `{anno}/{mese}/{uuid}.jpg`
- carica su Supabase Storage nel bucket `receipts-images`
- restituisce `image_path` al frontend

### Step 4 — Analisi AI
Il frontend invia `image_path` alla Edge Function `analyze-receipt`.
La Edge Function:
- legge l'immagine direttamente da Supabase Storage (nessun re-upload)
- la invia a Gemini richiedendo output JSON strutturato
- valida la risposta Gemini (parsing JSON, controllo campi)
- restituisce al frontend i dati estratti

### Step 5 — Revisione
Il frontend mostra una schermata di revisione con i campi precompilati, tutti editabili. I campi con confidence bassa sono evidenziati visivamente.

### Step 6 — Salvataggio
L'utente corregge/completa i dati e conferma.
Il frontend invia `image_path` + dati confermati alla Edge Function `save-receipt`.
La Edge Function:
- controlla duplicati (stessa data + vendor + importo)
- se duplicato trovato, restituisce warning (il frontend chiede conferma all'utente)
- genera signed URL per l'immagine (TTL 1 ora)
- salva il record completo nella tabella `receipts`
- restituisce id record + signed URL

### Step 7 — Conferma
L'app mostra conferma di salvataggio e aggiorna lo storico ricevute.

---

## SICUREZZA

- Le chiavi Gemini e la Service Role Key di Supabase devono essere usate **solo lato server** (Edge Functions), mai nel frontend
- Il frontend usa **solo anon key pubblica** per operazioni consentite da RLS
- Le Edge Functions devono validare input (dimensione immagine, formato, campi obbligatori) prima di chiamare Gemini o scrivere su DB
- Limiti dimensione immagine: max 5 MB dopo compressione, formati accettati: jpg, png, webp
- Le Edge Functions non devono mai restituire stack trace o dettagli interni al frontend

### CORS
- Ogni Edge Function deve includere headers CORS appropriati
- Permettere origin configurabili tramite variabile `ALLOWED_ORIGINS`
- Gestire correttamente le preflight OPTIONS requests
- Header minimi: `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`

### Rate Limiting
- Edge Function `analyze-receipt`: max 10 chiamate/minuto per IP
- Edge Function `upload-image`: max 20 chiamate/minuto per IP
- Edge Function `save-receipt`: max 30 chiamate/minuto per IP
- Implementare tramite contatore temporaneo su tabella Supabase o in-memory nella Edge Function

### RLS Policies (tabella receipts)

**Fase iniziale (mono-utente):**
```sql
-- Permetti tutte le operazioni con anon key (mono-utente)
CREATE POLICY "allow_all_anon" ON receipts
  FOR ALL USING (true) WITH CHECK (true);
```

**Fase multiutente (da attivare con Supabase Auth):**
```sql
CREATE POLICY "users_select_own" ON receipts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own" ON receipts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own" ON receipts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own" ON receipts
  FOR DELETE USING (auth.uid() = user_id);
```

---

## ESTRAZIONE DATI CON GEMINI

### Prompt Template per Gemini

```
Sei un sistema di estrazione dati da scontrini e ricevute fiscali italiane.
Analizza l'immagine allegata ed estrai i dati richiesti.

REGOLE FONDAMENTALI:
1. Restituisci ESCLUSIVAMENTE un oggetto JSON valido, senza markdown, senza commenti, senza testo aggiuntivo, senza ```json wrapper.
2. Se un campo non è leggibile o non presente, usa null per i numeri e stringa vuota "" per i testi.
3. NON inventare mai dati. Se non sei sicuro, metti null e confidence bassa.
4. Se l'immagine non è uno scontrino/ricevuta, imposta document_type su "non_ricevuta" e tutti gli altri campi a null/vuoto.
5. Data in formato YYYY-MM-DD, ora in formato HH:MM.
6. Importi numerici puliti (es. 12.50, non "€12,50"), valuta come codice ISO separato.
7. Per il campo confidence, assegna un valore da 0.0 a 1.0 per ogni campo chiave.

Schema JSON richiesto:
{
  "receipt_date": "",
  "receipt_time": "",
  "vendor_name": "",
  "vendor_vat_number": "",
  "total_amount": null,
  "currency": "",
  "vat_amount": null,
  "document_type": "",
  "receipt_number": "",
  "payment_method": "",
  "items": [
    {
      "description": "",
      "quantity": null,
      "unit_price": null,
      "total": null
    }
  ],
  "raw_text": "",
  "confidence": {
    "receipt_date": null,
    "receipt_time": null,
    "vendor_name": null,
    "total_amount": null,
    "items": null
  }
}

Valori accettati per document_type: "scontrino", "ricevuta_fiscale", "fattura", "nota_credito", "non_ricevuta", "altro"
Valori accettati per payment_method: "contanti", "carta_credito", "carta_debito", "bancomat", "satispay", "altro", ""
```

### Validazione risposta Gemini (nella Edge Function)
- Tentare JSON.parse sulla risposta
- Se fallisce, tentare di estrarre JSON da eventuale wrapper markdown (```json ... ```)
- Verificare che i campi obbligatori esistano (anche se null)
- Se la risposta è completamente invalida, restituire errore chiaro al frontend
- Loggare la raw response per debug (nel campo `raw_ai_response`)

---

## SCHERMATE DA CREARE

### 1) HOME / ACQUISIZIONE
- Titolo chiaro, es. "BillSnap" con sottotitolo "Acquisisci scontrino"
- Due azioni principali con icone grandi: "📸 Scatta foto" e "🖼️ Carica da galleria"
- Preview immagine dopo scatto/caricamento con possibilità di rimuoverla
- Indicatore compressione (es. "Immagine ottimizzata: 0.8 MB")
- Pulsante grande "Analizza scontrino" (disabilitato finché non c'è immagine)
- Stato di caricamento visibile durante upload + analisi (progress bar o spinner con testo)
- Layout a colonna singola, pulsanti grandi touch-friendly
- Bottom navigation bar con: Home, Storico, (futuro: Profilo)
- Input camera: usare `<input type="file" accept="image/*" capture="environment">` per scatto diretto, `<input type="file" accept="image/*">` per galleria

### 2) REVISIONE DATI ESTRATTI
- Immagine in alto (tappabile per zoom)
- Sezione dati principali: data (input date), ora (input time), ragione sociale (text)
- Sezione importi: importo totale (input number, step 0.01), valuta (select, default EUR), IVA (input number)
- Sezione documento: numero documento (text), tipo documento (select), metodo pagamento (select)
- Sezione line items: lista espandibile degli articoli estratti, ogni riga editabile (descrizione, quantità, prezzo unitario, totale), pulsante "+ Aggiungi riga"
- Sezione opzionale: note (textarea), categoria (select con opzioni comuni: alimentari, trasporti, ufficio, ristorazione, altro), tag (input con chips)
- Evidenziare campi con confidence < 0.6 con bordo arancione e icona ⚠️
- Evidenziare campi null/vuoti obbligatori con bordo rosso
- Bottom action bar con: "Salva" (primario), "Annulla" (secondario), "🔄 Rianalizza" (terziario)

### 3) CONFERMA SALVATAGGIO
- Messaggio di successo chiaro con icona ✅
- Riepilogo breve: vendor, data, importo
- Se duplicato rilevato: mostrare warning con "Salva comunque" / "Annulla"
- Due azioni: "🏠 Torna a Home" e "📋 Vai allo storico"

### 4) STORICO RICEVUTE
- Lista mobile a card, ordinata per data (più recente prima)
- Ogni card: thumbnail immagine (200x200), ragione sociale, data formattata (es. "5 Ago 2026"), importo con valuta, badge tipo documento
- Paginazione: scroll infinito, 20 elementi per caricamento
- Barra ricerca in alto: ricerca per ragione sociale (debounced, 300ms)
- Filtro per intervallo data (date picker range)
- Empty state se nessun risultato: "Nessuno scontrino salvato. Inizia scattando una foto!"
- Pull-to-refresh per aggiornare la lista
- Tap su card → apertura dettaglio

### 5) DETTAGLIO RICEVUTA
- Immagine full in alto (tappabile per zoom/fullscreen)
- Tutti i dati salvati in sezioni leggibili
- Line items in lista
- Note
- Data creazione e ultima modifica
- Bottom action bar: "✏️ Modifica" e "🗑️ Elimina"
- Elimina con modale di conferma ("Sei sicuro? Questa azione è irreversibile")
- Modifica apre la stessa schermata di revisione con dati precaricati

---

## SCHEMA SUPABASE (tabella receipts)

### Migration SQL completa

```sql
-- Tabella principale
CREATE TABLE receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  user_id uuid NULLABLE,  -- per futura autenticazione multiutente
  
  -- Dati documento
  receipt_date date,
  receipt_time text,
  vendor_name text,
  vendor_vat_number text NULLABLE,
  total_amount numeric,
  currency text NOT NULL DEFAULT 'EUR',
  vat_amount numeric NULLABLE,
  document_type text,
  receipt_number text NULLABLE,
  payment_method text NULLABLE,
  
  -- Dettaglio articoli
  items jsonb NULLABLE,  -- array di {description, quantity, unit_price, total}
  
  -- Metadati utente
  notes text NULLABLE,
  category text NULLABLE,
  tags jsonb NULLABLE,  -- array di stringhe
  
  -- Immagine
  image_path text NOT NULL,  -- percorso file nel bucket Supabase Storage
  image_url text NULLABLE,   -- signed URL (rigenerato on-demand)
  thumbnail_path text NULLABLE,  -- percorso thumbnail per lista
  
  -- Dati AI
  raw_ai_response jsonb NULLABLE,
  raw_text text NULLABLE,
  extraction_confidence jsonb NULLABLE,
  
  -- Stato
  status text NOT NULL DEFAULT 'saved'  -- saved, draft, deleted
);

-- Trigger updated_at automatico
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indici per performance
CREATE INDEX idx_receipts_user_date ON receipts(user_id, receipt_date DESC);
CREATE INDEX idx_receipts_vendor ON receipts USING gin(to_tsvector('italian', vendor_name));
CREATE INDEX idx_receipts_status ON receipts(status);
CREATE INDEX idx_receipts_created ON receipts(created_at DESC);

-- Abilita RLS
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Policy mono-utente iniziale (da sostituire con multiutente quando serve)
CREATE POLICY "allow_all_anon" ON receipts
  FOR ALL USING (true) WITH CHECK (true);
```

---

## STORAGE

- Bucket Supabase Storage: `receipts-images` (privato, non pubblico)
- Struttura file: `{anno}/{mese}/{uuid}.jpg` (es. `2026/08/a1b2c3d4.jpg`)
- Per thumbnails: `thumbs/{anno}/{mese}/{uuid}_thumb.jpg`
- Le Edge Functions gestiscono upload, non il frontend direttamente
- Signed URL con TTL di 1 ora, rigenerati on-demand quando il frontend carica un dettaglio o la lista
- Max dimensione file: 5 MB (dopo compressione client)
- Formati accettati: image/jpeg, image/png, image/webp

---

## EDGE FUNCTIONS DA CREARE

### 1) `upload-image`
- **Input**: immagine (multipart/form-data)
- **Validazione**: formato (jpeg, png, webp), dimensione (max 5 MB)
- **Azioni**: genera nome univoco, upload su Storage, genera thumbnail (opzionale)
- **Output**: `{ image_path, thumbnail_path }`
- **CORS**: sì

### 2) `analyze-receipt`
- **Input**: `{ image_path }` (JSON)
- **Validazione**: verifica che image_path esista su Storage
- **Azioni**: legge immagine da Storage, converte in base64, chiama Gemini con prompt template, valida risposta JSON
- **Output**: JSON strutturato con dati estratti + confidence
- **CORS**: sì
- **Timeout**: 30 secondi (Gemini può essere lento)

### 3) `save-receipt`
- **Input**: `{ image_path, thumbnail_path, ...dati_confermati }` (JSON)
- **Validazione**: campi obbligatori (image_path, total_amount, vendor_name, receipt_date), formati corretti
- **Azioni**: controlla duplicati, genera signed URL, INSERT su tabella receipts
- **Output**: `{ id, image_url, is_duplicate_warning }` 
- **CORS**: sì

### 4) `delete-receipt`
- **Input**: `{ id }` (JSON)
- **Validazione**: verifica che il record esista
- **Azioni**: elimina file da Storage (immagine + thumbnail), DELETE da tabella receipts
- **Output**: `{ success: true }`
- **CORS**: sì

### 5) `get-signed-url`
- **Input**: `{ image_path }` (JSON)
- **Azioni**: genera signed URL con TTL 1 ora
- **Output**: `{ signed_url, expires_at }`
- **CORS**: sì
- **Note**: usata dal frontend quando un signed URL è scaduto

### Struttura CORS comune (da includere in ogni Edge Function)
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGINS') || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

// Gestione preflight
if (req.method === 'OPTIONS') {
  return new Response(null, { status: 204, headers: corsHeaders });
}
```

---

## PREPROCESSING IMMAGINE (LATO CLIENT)

Implementare nel frontend prima di qualsiasi upload:

1. **Conversione formato**: se l'immagine è HEIC/HEIF (comune su iPhone), convertirla in JPEG usando `heic2any`
2. **Ridimensionamento**: max 1920px sul lato lungo, mantenendo aspect ratio
3. **Compressione**: qualità JPEG 80-85%, target dimensione < 1 MB
4. **Validazione**: rifiutare file > 10 MB prima della compressione, mostrare errore chiaro
5. **Feedback**: mostrare dimensione originale vs compressa (es. "12.3 MB → 0.8 MB")

Libreria consigliata: `browser-image-compression` con configurazione:
```javascript
const options = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: 'image/jpeg',
};
```

---

## PWA (Progressive Web App)

Configurare l'app come PWA installabile:

- `manifest.json` con: name "BillSnap", short_name "BillSnap", icone multiple (192, 512), theme_color, background_color, display: "standalone", start_url "/"
- Meta tag: `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, `<meta name="theme-color" content="...">`
- Service worker per caching assets statici (JS, CSS, fonts) — non per caching dati dinamici
- Splash screen personalizzata per iOS (apple-touch-startup-image)
- Viewport: `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">`

---

## GESTIONE ERRORI

Gestisci in modo chiaro ogni errore con messaggi user-friendly:

| Errore | Messaggio utente |
|---|---|
| Immagine assente | "Seleziona o scatta una foto prima di procedere" |
| Formato non supportato | "Formato immagine non supportato. Usa JPG, PNG o WebP" |
| File troppo grande | "L'immagine è troppo grande. Dimensione massima: 10 MB" |
| Upload fallito | "Errore durante il caricamento. Verifica la connessione e riprova" |
| Gemini non risponde | "L'analisi sta impiegando più del previsto. Riprova tra qualche secondo" |
| Risposta Gemini invalida | "Non siamo riusciti a leggere lo scontrino. Prova con una foto più nitida" |
| Immagine non è scontrino | "L'immagine non sembra uno scontrino o una ricevuta" |
| Errore salvataggio DB | "Errore durante il salvataggio. Riprova" |
| Duplicato rilevato | "Sembra che questo scontrino sia già stato salvato. Vuoi salvarlo comunque?" |
| Errore eliminazione | "Errore durante l'eliminazione. Riprova" |
| Rate limit superato | "Hai effettuato troppe richieste. Attendi un minuto e riprova" |
| Timeout connessione | "La connessione è lenta. Verifica la rete e riprova" |

Regole:
- Mai mostrare errori tecnici grezzi (stack trace, codici HTTP, messaggi Supabase raw)
- Ogni errore deve avere un pulsante "Riprova" dove applicabile
- Usare toast/snackbar per errori non bloccanti, modale per errori bloccanti
- Loggare errori dettagliati in console per debug

---

## UI/UX MOBILE

### Layout generale
- Layout a colonna singola su mobile, max-width 640px centrato su desktop
- Pulsanti grandi (min-height 48px), spaziatura generosa (gap 16px)
- Bottom navigation bar fissa per le sezioni principali (Home, Storico)
- Niente tabelle complesse, niente sidebar desktop-first
- Safe area insets per notch iPhone e barra gesti Android

### Input
- Input numerici con `inputmode="decimal"` per importi (tastiera numerica con punto)
- Selettore data nativo del browser (`<input type="date">`)
- Select nativi per categorie e tipi documento
- Textarea auto-growing per note

### Feedback visivo
- Skeleton loading per lista storico
- Progress indicator durante upload e analisi (non solo spinner generico)
- Toast di conferma per salvataggio riuscito
- Haptic feedback dove supportato (vibrazione breve su salvataggio)
- Transizioni fluide tra schermate (CSS transitions)

### Colori e design
- Palette coerente con primary color definito
- Dark mode supportata (CSS prefers-color-scheme)
- Bordi arrotondati su card e input (border-radius: 12px)
- Ombre sottili per elevazione card
- Font: Inter o system-ui per massima leggibilità

---

## ACCESSIBILITÀ

- Label `<label>` associato a ogni `<input>` tramite `for`/`id`
- Contrasto colori WCAG AA (rapporto minimo 4.5:1 per testo)
- Focus visibile su tutti gli elementi interattivi (outline, non solo colore)
- Attributi `aria-label` su pulsanti con sole icone
- `aria-live="polite"` per messaggi di stato (upload completato, errore, ecc.)
- Ruoli semantici corretti: `<main>`, `<nav>`, `<header>`, `<section>`
- Tab order logico

---

## RILEVAMENTO DUPLICATI

Nella Edge Function `save-receipt`, prima dell'INSERT:
1. Query: `SELECT id, vendor_name, total_amount FROM receipts WHERE receipt_date = $1 AND vendor_name = $2 AND total_amount = $3 AND status != 'deleted' LIMIT 1`
2. Se trovato risultato: restituire `{ is_duplicate_warning: true, existing_id: "..." }` senza salvare
3. Il frontend mostra warning: "Sembra che questo scontrino sia già stato salvato (Vendor, €Importo, Data). Vuoi salvarlo comunque?"
4. Se l'utente conferma, il frontend richiama `save-receipt` con flag `force_save: true`
5. Se `force_save: true`, saltare il controllo duplicati e procedere con INSERT

---

## THUMBNAILS

- Durante upload nella Edge Function `upload-image`, generare una versione ridotta dell'immagine (200x200px, JPEG qualità 60%)
- Salvare la thumbnail in `thumbs/{anno}/{mese}/{uuid}_thumb.jpg`
- Restituire `thumbnail_path` insieme a `image_path`
- La lista storico usa signed URL della thumbnail (molto più leggera)
- Il dettaglio ricevuta usa signed URL dell'immagine full
- Se la generazione thumbnail fallisce, non bloccare il flusso: salvare senza thumbnail e usare l'immagine full come fallback

---

## QUALITÀ E MANUTENIBILITÀ

### Struttura progetto Next.js consigliata
```
/app
  /page.tsx              → Home / Acquisizione
  /review/page.tsx       → Revisione dati estratti
  /history/page.tsx      → Storico ricevute
  /receipt/[id]/page.tsx → Dettaglio ricevuta
  /layout.tsx            → Layout con bottom nav
  /globals.css           → Design system e variabili CSS
/components
  /BottomNav.tsx
  /ReceiptCard.tsx
  /ImageCapture.tsx
  /ReviewForm.tsx
  /ConfirmDialog.tsx
  /LoadingState.tsx
  /EmptyState.tsx
  /Toast.tsx
/lib
  /supabase.ts           → Client Supabase configurato
  /image-utils.ts        → Compressione e conversione immagini
  /api.ts                → Wrapper chiamate Edge Functions
  /types.ts              → TypeScript types condivisi
/public
  /manifest.json
  /icons/
```

### Principi
- Componenti riutilizzabili, responsabilità singola
- TypeScript strict mode
- Variabili CSS custom per design system (colori, spacing, border-radius, font)
- Codice predisposto per estensioni future: multiutente reale, categorie spesa automatiche, dashboard riepilogo, export CSV
- Separazione netta tra logica frontend (UI, stato, validazione client) e logica server (Edge Functions: AI, storage, database)
- Error boundaries React per gestione errori imprevisti

---

## TESTING E VERIFICA

### Edge Functions
- Test manuale con `curl` per ogni Edge Function (upload, analyze, save, delete)
- Verificare gestione errori: immagine invalida, payload malformato, file troppo grande
- Verificare CORS con richiesta da dominio diverso
- Verificare rate limiting

### Frontend
- Test su dispositivi reali: iOS Safari (iPhone), Android Chrome
- Verificare scatto foto, caricamento galleria, conversione HEIC
- Verificare flusso completo end-to-end: scatto → compressione → upload → analisi → revisione → salvataggio → storico → dettaglio → modifica → elimina
- Verificare comportamento offline/rete lenta (timeout, retry)
- Verificare PWA: installazione su home screen, apertura standalone

---

## IMPORTANTISSIMO — VINCOLI NON NEGOZIABILI

1. **Nessuna chiave segreta nel frontend** — solo anon key pubblica
2. **Nessuna dipendenza da Google Drive o workflow esterni** — tutto nell'ecosistema Supabase
3. **Tutta la logica sensibile passa da Edge Functions** — Gemini, scrittura DB, upload file, generazione signed URL
4. **Upload immagine singolo** — l'immagine viene caricata una sola volta su Storage, poi referenziata via path
5. **Compressione obbligatoria lato client** — mai inviare immagini > 1 MB al server
6. **Mobile-first** — l'esperienza è pensata prima per smartphone, poi adattata a desktop
7. **Revisione manuale obbligatoria** — ogni campo estratto dall'AI deve poter essere corretto manualmente prima del salvataggio
8. **Nessun dato inventato dall'AI** — se Gemini non riesce a leggere un campo, deve restituire null, mai inventare
9. **CORS configurato** — ogni Edge Function deve gestire preflight e headers CORS
10. **Messaggi errore user-friendly** — mai errori tecnici grezzi all'utente
