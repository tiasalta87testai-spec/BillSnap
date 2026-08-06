# BillSnap — Frontend & Styling (V2 - Con Auth, Gruppi, Statistiche e Admin Panel)
### Per Antigravity (Gemini 3.6)
### Design System: Stitch "Precision Ledger" — Progetto BilllSnap AI

> Questo prompt copre il **frontend**: UI, componenti, styling, UX mobile, PWA, preprocessing immagini lato client e struttura progetto Next.js.
> Il backend (Edge Functions, DB, AI, Storage, Auth) è gestito dal prompt separato `prompt_backend_claude.md`.
> **Il design system e il layout delle schermate sono basati sul progetto Stitch** (ID: `5533646908941555020`) e devono essere riprodotti fedelmente.

---

## OBIETTIVO

Costruire il frontend di una web app mobile-first per acquisire scontrini e ricevute fiscali. L'app deve replicare fedelmente il design del progetto Stitch "BilllSnap AI" (design system "Precision Ledger") sia in versione light che dark mode, includendo ora:
1. **Autenticazione**: Accesso con email e password tramite Supabase Auth.
2. **Raggruppamento Scontrini**: Possibilità di creare gruppi/faldoni di spesa e associarvi le ricevute.
3. **Statistiche Spese**: Visualizzazione di grafici e dati su spesa totale, spesa per categoria, spesa per gruppo e trend mensile.
4. **Pannello Admin**: Schermate accessibili solo agli utenti Admin per gestire utenti e ruoli (Admin, Operatore) e configurare il salvataggio automatico (backup) su cloud esterni (Google Drive, Dropbox, OneDrive, iCloud).

---

## RIFERIMENTO DESIGN — PROGETTO STITCH

Le schermate di riferimento si trovano nella cartella `FileMd/stitch_screens/`:
- **Light Mode**: `Acquisisci_scontrino_light.png`, `Analisi_in_corso_light.png`, `Revisione_dati_light.png`, `Conferma_salvataggio_light.png`, `Storico_ricevute_light.png`, `Dettaglio_ricevuta_light.png`
- **Dark Mode**: Versioni corrispondenti `*_dark.png`.

> [!IMPORTANT]
> Replicare fedelmente layout, spaziature, colori, tipografia e gerarchia visiva di queste schermate. Ogni aggiunta funzionale (Login, Statistiche, Admin) deve ereditare lo stesso design system.

---

## STACK FRONTEND

- **Framework**: Next.js 14+ (App Router), deploy su Vercel
- **Styling**: CSS Modules con variabili CSS custom basate sul design system Stitch "Precision Ledger". NO TailwindCSS
- **Font**: Inter (Google Fonts)
- **Icone**: Lucide React, 24px outline, stroke 2px (come da specifiche Stitch)
- **Compressione**: `browser-image-compression` + `heic2any` (lato client)
- **Supabase**: `@supabase/supabase-js` (con gestione di sessione auth, token JWT allegati e anon key pubblica)
- **TypeScript**: strict mode

---

## DESIGN SYSTEM — "PRECISION LEDGER" (da Stitch)

### Palette colori — Light Mode
Definire variabili CSS in `globals.css`:
```css
:root {
  /* Surface system */
  --color-surface: #f9f9ff;
  --color-surface-dim: #d3daef;
  --color-surface-bright: #f9f9ff;
  --color-surface-container-lowest: #ffffff;
  --color-surface-container-low: #f1f3ff;
  --color-surface-container: #e9edff;
  --color-surface-container-high: #e1e8fd;
  --color-surface-container-highest: #dce2f7;
  --color-surface-variant: #dce2f7;
  --color-surface-tint: #0053db;

  /* Primary */
  --color-primary: #004ac6;
  --color-on-primary: #ffffff;
  --color-primary-container: #2563eb;
  --color-on-primary-container: #eeefff;
  --color-inverse-primary: #b4c5ff;

  /* Secondary */
  --color-secondary: #5c5f60;
  --color-on-secondary: #ffffff;
  --color-secondary-container: #e1e3e4;
  --color-on-secondary-container: #626566;

  /* Tertiary (Confidence Yellow) */
  --color-tertiary: #665f3d;
  --color-on-tertiary: #ffffff;
  --color-tertiary-container: #b4ab84;
  --color-on-tertiary-container: #453f20;
  --color-confidence-low: #FEF3C7;  /* Evidenziazione campi confidence bassa */

  /* Text & Border */
  --color-on-surface: #141b2b;
  --color-on-surface-variant: #434655;
  --color-on-background: #141b2b;
  --color-outline: #737686;
  --color-outline-variant: #c3c6d7;
  --color-border-card: #E5E7EB;
  --color-divider: #F3F4F6;

  /* Semantic */
  --color-error: #ba1a1a;
  --color-on-error: #ffffff;
  --color-error-container: #ffdad6;
  --color-on-error-container: #93000a;
  --color-success: #00B894;
  --color-warning: #FDCB6E;
  --color-background: #f9f9ff;

  /* Spacing */
  --space-base: 4px;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-safe-margin: 20px;
  --space-gutter: 16px;

  /* Border radius */
  --radius-sm: 0.25rem;
  --radius-default: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  --radius-full: 9999px;

  /* Elevation */
  --shadow-level-0: none;
  --shadow-level-1: 0px 2px 4px rgba(0,0,0,0.05);
  --shadow-level-2: 0px 10px 15px rgba(0,0,0,0.1);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
}
```

### Palette colori — Dark Mode
```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-surface: #0b1326;
    --color-surface-dim: #0b1326;
    --color-surface-bright: #31394d;
    --color-surface-container-lowest: #060e20;
    --color-surface-container-low: #131b2e;
    --color-surface-container: #171f33;
    --color-surface-container-high: #222a3d;
    --color-surface-container-highest: #2d3449;
    --color-surface-variant: #2d3449;
    --color-surface-tint: #b4c5ff;

    --color-primary: #b4c5ff;
    --color-on-primary: #002a78;
    --color-primary-container: #2563eb;
    --color-on-primary-container: #eeefff;
    --color-inverse-primary: #0053db;

    --color-secondary: #bcc7de;
    --color-on-secondary: #263143;
    --color-secondary-container: #3e495d;
    --color-on-secondary-container: #aeb9d0;

    --color-tertiary: #ffb596;
    --color-on-tertiary: #581e00;
    --color-tertiary-container: #bc4800;
    --color-on-tertiary-container: #ffede6;

    --color-on-surface: #dae2fd;
    --color-on-surface-variant: #c3c6d7;
    --color-on-background: #dae2fd;
    --color-outline: #8d90a0;
    --color-outline-variant: #434655;
    --color-border-card: #334155;
    --color-divider: #334155;

    --color-error: #ffb4ab;
    --color-on-error: #690005;
    --color-error-container: #93000a;
    --color-on-error-container: #ffdad6;
    --color-background: #0b1326;

    --shadow-level-0: none;
    --shadow-level-1: none; /* usa bordo 1px #334155 in dark mode */
    --shadow-level-2: 0px 4px 20px rgba(0,0,0,0.5);
  }
}
```

---

## STRUTTURA PROGETTO AGGIORNATA

```
/app
  layout.tsx                → Layout root con bottom nav (Home, Storico, Statistiche, Impostazioni)
  page.tsx                  → Home / Acquisisci scontrino (protetta)
  /login
    page.tsx                → Schermata di login / registrazione
  /review
    page.tsx                → Revisione dati estratti
  /history
    page.tsx                → Storico ricevute
  /stats
    page.tsx                → Dashboard Statistiche e grafici
  /groups
    page.tsx                → Gestione gruppi/faldoni di spesa
  /admin
    /users
      page.tsx              → Pannello Gestione Utenti e Ruoli (solo Admin)
    /cloud
      page.tsx              → Pannello Configurazione Backup Cloud (solo Admin)
  /receipt
    /[id]
      page.tsx              → Dettaglio ricevuta
      /edit
        page.tsx            → Modifica ricevuta
  globals.css               → Design system Precision Ledger completo
```

---

## SCHERMATE AGGIUNTIVE — SPECIFICHE E WIREFRAME

### 1) LOGIN & REGISTRAZIONE (`/login`)

**Layout:**
```
┌─────────────────────────────┐
│                             │
│          ◎ BillSnap         │  ← Logo e titolo
│       Accedi all'app        │
│                             │
│   Email                     │
│   ┌─────────────────────────┐
│   │ utente@email.com        │ │
│   └─────────────────────────┘
│   Password                  │
│   ┌─────────────────────────┐
│   │ ••••••••••••••••        │ │
│   └─────────────────────────┘
│                             │
│   ┌─────────────────────────┐
│   │        🔓 Accedi        │ │  ← Pulsante primario
│   └─────────────────────────┘
│                             │
│       Non hai un account?   │
│       Crea un account       │  ← link secondario
│                             │
└─────────────────────────────┘
```
**Comportamento:**
- Usa Supabase Auth client per eseguire l'accesso con Email e Password.
- Se l'utente non ha un account, permette di cambiare modalità in "Registrazione".
- Al successo, salva la sessione e reindirizza alla Home (`/`).
- Gestione chiara degli errori (password errata, email malformata) con notifica Toast.

---

### 2) STATISTICHE (`/stats`)

**Layout:**
```
┌─────────────────────────────┐
│  Statistiche Spese          │
├─────────────────────────────┤
│  Filtro Periodo             │
│  ┌────────────────────────┐ │
│  │ Ultimi 30 giorni     ▼ │ │  ← dropdown periodo
│  └────────────────────────┘ │
├─────────────────────────────┤
│                             │
│  Totale Speso               │
│  € 1,250.45                 │  ← Valore primario tnum
│  Spesa media: €34.73        │  ← Dettaglio
│                             │
│  ┌────────────────────────┐ │
│  │    [Grafico Trend]     │ │  ← trend mensile o a barre semplice
│  │   Barre verticali CSS  │ │
│  └────────────────────────┘ │
│                             │
│  Per Categoria              │
│  Ristorazione  ■■■■■  €420  │  ← barre di percentuale in CSS
│  Alimentari    ■■■    €310  │
│                             │
│  Per Gruppo                 │
│  Milano 2026   ■■■■■  €550  │
│  Ufficio       ■      €120  │
│                             │
├─────────────────────────────┤
│ Home │ Storico │ Stats │ Imp│  ← bottom nav a 4 icone
└─────────────────────────────┘
```
**Comportamento:**
- Recupera i dati dall'Edge Function `get-user-stats` passando l'intervallo temporale.
- Utilizza puro CSS per disegnare i grafici (es. barre verticali per il trend, barre orizzontali ad accumulo per le percentuali di categorie e gruppi) per evitare librerie esterne pesanti e mantenere lo styling coerente.
- Mostra uno stato di caricamento Skeleton durante il fetch.

---

### 3) CONFIGURAZIONE GRUPPI (`/groups`)

**Layout:**
```
┌─────────────────────────────┐
│  ← Impostazioni  Gruppi     │
├─────────────────────────────┤
│  [+ Nuovo Gruppo]           │  ← apre modale/riga inserimento
├─────────────────────────────┤
│                             │
│  Faldoni Attivi             │
│  ┌────────────────────────┐ │
│  │ 📂 Trasferta Milano    │ │  ← Swipe per eliminare/modificare
│  │    15 scontrini · €550 │ │
│  └────────────────────────┘ │
│  ┌────────────────────────┐ │
│  │ 📂 Spese Ufficio       │ │
│  │    5 scontrini · €120  │ │
│  └────────────────────────┘ │
│                             │
└─────────────────────────────┘
```
**Comportamento:**
- Consente all'utente di creare un gruppo assegnando un nome, descrizione e colore identificativo.
- Permette di modificare o eliminare un gruppo.
- Le ricevute nella pagina di revisione e dettaglio potranno essere assegnate a questi gruppi tramite un selettore a tendina (`<select>`).

---

### 4) AMMINISTRAZIONE UTENTI (`/admin/users`)

**Layout:**
```
┌─────────────────────────────┐
│  ← Impostazioni  Utenti     │
├─────────────────────────────┤
│  Cerca utente...            │
├─────────────────────────────┤
│                             │
│  Lista Utenti               │
│  ┌────────────────────────┐ │
│  │ Mario Rossi            │ │
│  │ operator@email.com     │ │
│  │ Ruolo: Operatore   [▼] │ │  ← dropdown per cambiare ruolo
│  │ [Sospendi]  [Elimina]  │ │
│  └────────────────────────┘ │
│  ┌────────────────────────┐ │
│  │ Laura Bianchi          │ │
│  │ admin@email.com        │ │
│  │ Ruolo: Admin       [▼] │ │
│  └────────────────────────┘ │
│                             │
└─────────────────────────────┘
```
**Comportamento:**
- Accessibile solo se `profile.role === 'Admin'`. In caso contrario, mostra redirect 403 o vuoto.
- Chiama la Edge Function `admin-manage-users` per recuperare ed editare utenti.
- Consente all'Admin di cambiare il ruolo di un utente tramite selettore (`Admin` o `Operatore`).

---

### 5) CONFIGURAZIONE BACKUP CLOUD (`/admin/cloud`)

**Layout:**
```
┌─────────────────────────────┐
│  ← Impostazioni  Cloud      │
├─────────────────────────────┤
│  Backup Automatico Cloud    │
│  Stato: [ Attivo / Spento ] │  ← Toggle switch
├─────────────────────────────┤
│  Provider                   │
│  ( ) Google Drive           │  ← radio button
│  (•) Dropbox                │
│  ( ) OneDrive               │
│  ( ) iCloud                 │
│                             │
│  Percorso di Salvataggio    │
│  ┌─────────────────────────┐
│  │ /BillSnap/Receipts      │ │  ← input di testo
│  └─────────────────────────┘
│                             │
│  Autenticazione Cloud       │
│  [ Collegati al Provider ]  │  ← Apre popup OAuth2 del provider
│  Stato: Collegato ✅        │
│                             │
│  ┌─────────────────────────┐
│  │      ✓ Salva Config     │ │  ← pulsante primario
│  └─────────────────────────┘
└─────────────────────────────┘
```
**Comportamento:**
- Permette all'Admin di selezionare il provider di destinazione per salvare in modo ridondato le immagini.
- Gestisce il flusso OAuth o l'inserimento dei parametri di connessione.
- Salva la configurazione invocando la Edge Function dedicata o scrivendo sulla tabella `cloud_settings`.

---

## MODIFICHE ALLA FORM DI REVISIONE (`/review`)

Nella schermata di revisione dati estratti, integrare i seguenti campi:
- **Gruppo (Faldone)**: Un selettore a tendina (`<select>`) alimentato con la lista dei gruppi dell'utente loggato, per categorizzare immediatamente lo scontrino.
- **Stato Sync Cloud**: Un piccolo indicatore visivo dello stato di backup su cloud (`pending`, `synced`, `failed`). Se lo stato è `failed`, mostra una label "Backup fallito" e un'icona "Riprova" per reinviare il file al cloud.

---

## CHIAMATE API CON AUTENTICAZIONE JWT

Modulo `/lib/api.ts` aggiornato per gestire il JWT di Supabase in ogni chiamata alle Edge Functions:

```typescript
import { supabase } from './supabase';

const EF_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function callEdgeFunction<T>(name: string, body: any, isFormData = false): Promise<T> {
  // Recupera il token JWT dalla sessione attiva di Supabase Auth
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  };

  if (!isFormData) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${EF_BASE}/${name}`, {
    method: 'POST',
    headers,
    body: isFormData ? body : JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Errore sconosciuto' }));
    throw new ApiError(response.status, error.message || 'Errore del server');
  }
  return response.json();
}

export const api = {
  uploadImage: (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return callEdgeFunction<{ image_path: string; thumbnail_path: string }>('upload-image', fd, true);
  },
  analyzeReceipt: (imagePath: string) =>
    callEdgeFunction<any>('analyze-receipt', { image_path: imagePath }),
  saveReceipt: (data: any) =>
    callEdgeFunction<{ id: string; image_url: string; is_duplicate_warning?: boolean }>('save-receipt', data),
  deleteReceipt: (id: string) =>
    callEdgeFunction<{ success: boolean }>('delete-receipt', { id }),
  getSignedUrl: (imagePath: string) =>
    callEdgeFunction<{ signed_url: string; expires_at: string }>('get-signed-url', { image_path: imagePath }),
  
  // NUOVE CHIAMATE MULTIUTENTE & ADMIN
  getUserStats: (filters?: { start_date?: string; end_date?: string }) =>
    callEdgeFunction<any>('get-user-stats', filters || {}),
  adminManageUsers: (action: 'list' | 'update_role' | 'delete', payload?: any) =>
    callEdgeFunction<any>('admin-manage-users', { action, ...payload }),
};
```

---

## VINCOLI FRONTEND V2

1. **Gestione dello Stato Utente**: Proteggere tutte le rotte dell'app (escluso `/login`) verificando la presenza di una sessione Supabase attiva. In caso di sessione assente, reindirizzare immediatamente a `/login`.
2. **Controllo dei Ruoli**: La voce di menu "Impostazioni Admin" nella bottom nav o nel menu dell'applicazione deve essere visibile **solo se il profilo dell'utente ha ruolo `Admin`**.
3. **PWA Standalone & Notch**: Gestire correttamente le insets safe-area in CSS su tutte le nuove schermate per prevenire sovrapposizioni visive su smartphone iOS e Android.
4. **Grafici CSS nativi**: Non importare librerie grafiche esterne (es. Chart.js o Recharts) per mantenere l'app fulminea e leggera; implementare i grafici di `/stats` tramite barre orizzontali/verticali CSS e container ad aspect-ratio fisso.
5. **Nessuna chiave esposta**: Continuare a far transitare tutte le operazioni sensibili per le credenziali cloud e Gemini tramite le Edge Functions.
6. **Supporto Offline**: Implementare una cache locale tramite state o indexDB per visualizzare le ultime ricevute dello storico anche in assenza temporanea di rete.
