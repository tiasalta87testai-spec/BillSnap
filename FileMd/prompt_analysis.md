# Analisi e Miglioramento del Prompt BillSnap

## Valutazione Complessiva

| Aspetto | Voto | Note |
|---|---|---|
| Struttura e chiarezza | ⭐⭐⭐⭐⭐ | Eccellente organizzazione per sezioni |
| Architettura | ⭐⭐⭐⭐ | Solida, ma con una inefficienza nel flusso |
| Sicurezza | ⭐⭐⭐⭐ | Buone pratiche, mancano alcuni dettagli |
| Schema DB | ⭐⭐⭐⭐ | Completo, mancano indici e trigger |
| UX/Mobile | ⭐⭐⭐⭐ | Buone indicazioni, manca PWA e offline |
| Completezza tecnica | ⭐⭐⭐ | Diverse omissioni importanti (vedi sotto) |

---

## 🔴 Problemi Critici

### 1. Framework frontend non specificato

Il prompt dice "pubblicato su Vercel" ma **non indica quale framework usare**. Questa è l'omissione più importante: React? Next.js? Vue? Svelte? Vanilla JS? La scelta impatta tutto: routing, SSR/CSR, struttura progetto, DX.

> [!IMPORTANT]
> **Fix suggerito**: Specificare esplicitamente il framework. Per questa app consiglio **Next.js (App Router)** perché:
> - Deploy nativo su Vercel
> - Supporto SSR/SSG per la lista storico
> - File-based routing semplifica la struttura
> - React ecosystem maturo per form e stato

### 2. Doppio invio immagine (inefficienza nel flusso)

Nel flusso attuale:
- **Step 2**: il frontend invia l'immagine a `analyze-receipt`
- **Step 6**: il frontend invia **di nuovo** la stessa immagine a `save-receipt`

Questo significa che un'immagine da 3-5 MB viene inviata **due volte** su rete mobile. Su 4G lento o con piani dati limitati, è un problema reale.

> [!IMPORTANT]
> **Fix suggerito — Flusso ottimizzato in 2 opzioni:**
>
> **Opzione A (consigliata)**: Upload-first
> 1. Frontend → Edge Function `upload-image` → Supabase Storage → restituisce `image_path`
> 2. Frontend → Edge Function `analyze-receipt` con `image_path` (la EF legge da Storage)
> 3. Frontend → Edge Function `save-receipt` con `image_path` + dati confermati (nessun re-upload)
>
> **Opzione B**: Analisi con cache temporanea
> 1. `analyze-receipt` riceve immagine, la salva in una cartella `temp/` su Storage, analizza, restituisce JSON + `temp_image_path`
> 2. `save-receipt` riceve `temp_image_path` + dati → sposta immagine da `temp/` a cartella definitiva

### 3. Nessuna compressione immagine lato client

Le fotocamere smartphone producono immagini da **5-15 MB**. Gemini accetta immagini grandi, ma il tempo di upload su mobile è critico. Nessuna menzione di compressione.

> [!IMPORTANT]
> **Fix suggerito**: Aggiungere una sezione:
> ```
> PREPROCESSING IMMAGINE (LATO CLIENT)
> - Ridimensiona l'immagine a max 1920px sul lato lungo
> - Comprimi a qualità JPEG 80-85%
> - Converti HEIC → JPEG prima dell'upload
> - Target dimensione finale: < 1 MB
> - Mostra preview dell'immagine compressa, non dell'originale
> ```

### 4. Modello Gemini non specificato

Il prompt dice "Gemini" ma non specifica quale modello. La differenza tra `gemini-2.0-flash` e `gemini-2.5-pro` è enorme in termini di costo, velocità e qualità di estrazione.

> [!IMPORTANT]
> **Fix suggerito**: Specificare `gemini-2.5-flash` come default (buon compromesso costo/qualità per OCR di scontrini), con possibilità di upgrade a `gemini-2.5-pro` per documenti complessi.

---

## 🟠 Problemi Significativi

### 5. Nessuna menzione CORS

Le Edge Functions Supabase sono chiamate da un dominio Vercel diverso. Senza configurazione CORS, **tutte le chiamate falliranno**.

> **Fix**: Aggiungere:
> ```
> CORS
> - Ogni Edge Function deve includere headers CORS appropriati
> - Permettere origin dal dominio Vercel di produzione + localhost per sviluppo
> - Gestire correttamente le preflight OPTIONS requests
> ```

### 6. Nessuna strategia PWA

Per un'app "che sembri una vera mobile app web", manca completamente la configurazione PWA.

> **Fix**: Aggiungere:
> ```
> PWA
> - Manifest.json con nome app, icone, theme color, display: standalone
> - Service worker per caching assets statici
> - Splash screen personalizzata
> - Aggiunta a Home Screen supportata
> - Meta tag viewport e apple-mobile-web-app-capable
> ```

### 7. Nessuna policy RLS definita

Il prompt dice "RLS abilitata su tutte le tabelle" ma non definisce le policy. Senza policy specifiche, RLS abilitata **blocca tutto** (default deny).

> **Fix**: Aggiungere:
> ```
> RLS POLICIES (tabella receipts)
> - Fase iniziale (mono-utente): policy permissiva con anon key per SELECT/INSERT/UPDATE/DELETE
> - Fase multiutente: 
>   - SELECT: auth.uid() = user_id
>   - INSERT: auth.uid() = user_id (con default su user_id)
>   - UPDATE: auth.uid() = user_id
>   - DELETE: auth.uid() = user_id
> ```

### 8. Nessuna menzione di paginazione

La lista storico ricevute crescerà nel tempo. Senza paginazione, le query diventeranno lente.

> **Fix**: Specificare:
> ```
> PAGINAZIONE
> - Storico ricevute: caricamento a scroll infinito o paginazione, 20 elementi per pagina
> - Ordinamento default: data più recente prima
> - Query con LIMIT/OFFSET o cursor-based pagination
> ```

### 9. Nessun indice database

Lo schema non menziona indici. Le query su `receipt_date`, `vendor_name`, `user_id` saranno lente senza indici.

> **Fix**: Aggiungere al migration SQL:
> ```sql
> CREATE INDEX idx_receipts_user_date ON receipts(user_id, receipt_date DESC);
> CREATE INDEX idx_receipts_vendor ON receipts(vendor_name);
> CREATE INDEX idx_receipts_status ON receipts(status);
> ```

### 10. Nessun trigger per `updated_at`

Lo schema ha `updated_at` ma senza un trigger, resterà sempre NULL.

> **Fix**: Aggiungere:
> ```sql
> CREATE OR REPLACE FUNCTION update_updated_at()
> RETURNS TRIGGER AS $$
> BEGIN
>   NEW.updated_at = NOW();
>   RETURN NEW;
> END;
> $$ LANGUAGE plpgsql;
> 
> CREATE TRIGGER set_updated_at
>   BEFORE UPDATE ON receipts
>   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
> ```

### 11. Nessun rate limiting

Senza rate limiting, un utente (o un bot) potrebbe fare centinaia di chiamate a Gemini, generando costi elevati.

> **Fix**: Aggiungere:
> ```
> RATE LIMITING
> - Edge Function analyze-receipt: max 10 chiamate/minuto per IP/utente
> - Edge Function save-receipt: max 30 chiamate/minuto
> - Implementare tramite contatore su Redis/Supabase o header-based limiting
> ```

### 12. Nessuna strategia per thumbnails

La lista storico mostra "piccola preview immagine" ma caricare immagini full-size per ogni card è lento e costoso in banda.

> **Fix**: Aggiungere:
> ```
> THUMBNAILS
> - Durante upload, generare thumbnail 200x200px (via Edge Function o Supabase Image Transformation)
> - Salvare path thumbnail separato o usare URL con parametri di resize
> - Lista storico usa solo thumbnail, dettaglio usa immagine full
> ```

---

## 🟡 Miglioramenti Consigliati

### 13. Prompt Gemini non fornito

Il prompt specifica il formato JSON di output ma non il **prompt testuale** da inviare a Gemini. La qualità dell'estrazione dipende enormemente da questo.

> **Fix suggerito**: Includere il prompt template:
> ```
> PROMPT GEMINI (template)
> "Analizza questa immagine di uno scontrino o ricevuta fiscale italiana.
> Estrai i dati e restituisci ESCLUSIVAMENTE un oggetto JSON valido, 
> senza markdown, senza commenti, senza testo aggiuntivo.
> 
> Se un campo non è leggibile o non presente, usa null per i numeri 
> e stringa vuota "" per i testi. NON inventare mai dati.
> 
> Se l'immagine non è uno scontrino/ricevuta, imposta document_type 
> su "non_ricevuta" e tutti gli altri campi a null/vuoto.
> 
> Per il campo confidence, assegna un valore da 0.0 a 1.0 che indica 
> quanto sei sicuro dell'estrazione di quel campo specifico.
> 
> Schema JSON richiesto: { ... }"
> ```

### 14. Nessuna menzione di line items (righe articolo)

Lo schema salva solo il totale, ma uno scontrino contiene anche le singole voci. Questa è una funzionalità preziosa per l'analisi spese.

> **Fix suggerito**: Aggiungere campo `items` allo schema:
> ```json
> "items": [
>   { "description": "Caffè", "quantity": 2, "unit_price": 1.20, "total": 2.40 }
> ]
> ```
> E campo corrispondente nella tabella:
> ```sql
> items jsonb nullable  -- array di oggetti con description, quantity, unit_price, total
> ```

### 15. Nessuna strategia di rilevamento duplicati

Senza controllo, lo stesso scontrino può essere salvato più volte.

> **Fix**: Aggiungere:
> ```
> DUPLICATI
> - Al salvataggio, verificare se esiste già un record con stessa data + 
>   stesso vendor + stesso importo totale
> - Se potenziale duplicato trovato, avvisare l'utente con possibilità 
>   di "Salva comunque" o "Annulla"
> ```

### 16. Signed URL: TTL non specificato

Il prompt menziona signed URL ma non la durata.

> **Fix**: Specificare: `Signed URL con TTL di 1 ora per visualizzazione, rigenerati on-demand`

### 17. Nessuna menzione di accessibilità (a11y)

> **Fix**: Aggiungere:
> ```
> ACCESSIBILITÀ
> - Label associati a ogni input
> - Contrasto colori WCAG AA
> - Focus visibile su elementi interattivi
> - Attributi aria-label su pulsanti con sole icone
> ```

### 18. Nessuna menzione di testing

> **Fix**: Aggiungere:
> ```
> TESTING
> - Edge Functions: test con curl/httpie per verificare input/output
> - Frontend: test manuali su dispositivi reali (iOS Safari, Android Chrome)
> - Verificare flusso completo: scatto → analisi → revisione → salvataggio → storico
> ```

### 19. Variabili d'ambiente: elenco non specificato

Il prompt dice "variabili ambiente configurabili" ma non le elenca.

> **Fix**: Specificare:
> ```
> VARIABILI D'AMBIENTE
> Frontend (.env.local):
>   - NEXT_PUBLIC_SUPABASE_URL
>   - NEXT_PUBLIC_SUPABASE_ANON_KEY
> 
> Edge Functions (Supabase secrets):
>   - SUPABASE_SERVICE_ROLE_KEY
>   - GEMINI_API_KEY
>   - GEMINI_MODEL (default: gemini-2.5-flash)
> ```

### 20. Valuta default non specificata

Per un'app italiana, la valuta default dovrebbe essere EUR.

> **Fix**: Nel campo `currency` dello schema, specificare `default 'EUR'`

---

## 📝 Sezioni Mancanti da Aggiungere

| Sezione | Priorità | Motivo |
|---|---|---|
| Framework frontend (Next.js) | 🔴 Critica | Senza questa, il prompt è incompleto |
| Compressione immagine client-side | 🔴 Critica | Performance mobile |
| Modello Gemini specifico | 🔴 Critica | Impatta costi e qualità |
| Configurazione CORS | 🟠 Alta | Senza, le Edge Functions non funzionano |
| Policy RLS dettagliate | 🟠 Alta | Senza policy, RLS blocca tutto |
| PWA manifest + service worker | 🟠 Alta | Necessario per "app-like experience" |
| Paginazione storico | 🟠 Alta | Scalabilità |
| Indici database | 🟠 Alta | Performance query |
| Rate limiting | 🟠 Alta | Protezione costi Gemini |
| Prompt Gemini template | 🟡 Media | Qualità estrazione |
| Line items (righe articolo) | 🟡 Media | Valore funzionale |
| Rilevamento duplicati | 🟡 Media | Data quality |
| Thumbnails per lista | 🟡 Media | Performance mobile |
| Accessibilità | 🟡 Media | Best practice |
| Elenco env vars | 🟡 Media | Chiarezza setup |

---

## ✅ Punti di Forza (da mantenere)

Questi aspetti sono **eccellenti** e vanno preservati così come sono:

1. **Separazione netta frontend/backend** — chiavi server-side only, logica sensibile nelle Edge Functions
2. **Flusso in step chiari** — numerati e comprensibili
3. **Schema DB dettagliato** — campi ben pensati con tipi corretti
4. **Sezione sicurezza esplicita** — raro vederla in un prompt
5. **Schermate dettagliate** — ogni schermata ha indicazioni precise
6. **Confidence score per campo** — permette UX intelligente (evidenziare campi incerti)
7. **Indicazioni UX mobile specifiche** — non generiche, ma operative (pulsanti grandi, colonna singola, bottom bar)
8. **Estensibilità prevista** — multiutente, categorie automatiche, export CSV
