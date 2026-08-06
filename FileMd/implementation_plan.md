# Integrazione Google Drive (OAuth2 e Sincronizzazione Backup)

Questo piano descrive come implementare l'autenticazione OAuth2 tramite un'Edge Function dedicata (`auth-cloud`) e integrare il salvataggio automatico delle immagini degli scontrini su Google Drive nella cartella configurata dall'Admin.

---

## Flusso Funzionale dell'Integrazione

1. **Configurazione Developer**:
   L'amministratore crea un'app nella console sviluppatori di Google Cloud e imposta come **Redirect URI** l'indirizzo dell'Edge Function di Supabase:
   `https://kkuitfbewuxrkysvvxyz.supabase.co/functions/v1/auth-cloud`
   
2. **Collegamento dell'Account**:
   Nel pannello Admin, un pulsante "Connetti Google Drive" reindirizza l'utente all'Edge Function:
   `https://kkuitfbewuxrkysvvxyz.supabase.co/functions/v1/auth-cloud?action=authorize`
   
3. **Rilascio e Salvataggio Token**:
   Google chiede il consenso e reindirizza al Callback di Supabase. L'Edge Function scambia il codice temporaneo per un **Access Token** e un **Refresh Token** a lungo termine, salvandoli nella colonna `credentials` di `cloud_settings` nel database.

4. **Sincronizzazione in Background**:
   Quando l'utente inserisce uno scontrino tramite `save-receipt`, il backend controlla se il backup cloud è attivo. Se sì, effettua l'upload in background dell'immagine su Google Drive nel percorso configurato (es: `/BillSnap/Scontrini`).

---

## Modifiche Proposte

### 1. Nuova Edge Function [`auth-cloud`](file:///c:/Users/matti/OneDrive/Desktop/Progetti/BillSnap/supabase/functions/auth-cloud/index.ts) [NEW]
Creeremo una nuova funzione Deno che gestisce due rotte:
- **`GET /auth-cloud?action=authorize`**: Avvia il flusso OAuth, reindirizzando l'utente alla schermata di autorizzazione di Google.
- **`GET /auth-cloud` (con parametri `code` e `state` da Google)**: Gestisce il callback di ritorno. Effettua la richiesta POST a `https://oauth2.googleapis.com/token` per ottenere i token finali e li salva in `cloud_settings.credentials`. Successivamente reindirizza l'utente alla pagina `/admin?status=success`.

### 2. Modifica Edge Function [`save-receipt`](file:///c:/Users/matti/OneDrive/Desktop/Progetti/BillSnap/supabase/functions/save-receipt/index.ts) [MODIFY]
All'interno dell'Edge Function per il salvataggio degli scontrini, integreremo un helper asincrono che:
1. Controlla in `cloud_settings` se `is_active` è `true` e il provider è `drive`.
2. Ottiene i token di accesso e, se scaduti, li rigenera usando il `refresh_token`.
3. Crea la cartella o naviga nel percorso impostato in `backup_path` su Google Drive.
4. Carica l'immagine (in base64 o convertendo il file scaricato da Supabase Storage) nella cartella corretta.

### 3. Modifica Interfaccia Admin [`app/admin/page.tsx`](file:///c:/Users/matti/OneDrive/Desktop/Progetti/BillSnap/app/admin/page.tsx) [MODIFY]
Aggiungeremo un pulsante per il collegamento del cloud nella UI:
- Mostra *"Stato Connessione: Collegato"* o *"Scollegato"* in base alla presenza di dati in `credentials`.
- Pulsante *"Connetti Account Google"* che apre la rotta di autenticazione per autorizzare Google Drive.

---

## Configurazione Credenziali di Google Cloud (Developer)
Per rendere funzionante il flusso, dovranno essere impostati i seguenti segreti sul progetto Supabase:
- `GOOGLE_CLIENT_ID`: ID Client OAuth ottenuto da Google Cloud Console.
- `GOOGLE_CLIENT_SECRET`: Segreto Client ottenuto da Google Cloud Console.

---

## Piano di Verifica

### 1. Test Flusso OAuth
- Cliccare su **"Connetti Account Google"** nel pannello di amministrazione.
- Completare il consenso su Google.
- Verificare che si venga reindirizzati su `/admin?status=success` e che compaia lo stato "Collegato".
- Controllare che la tabella `cloud_settings` contenga i token `access_token` e `refresh_token` crittografati o salvati nel campo `credentials`.

### 2. Test Backup
- Caricare uno scontrino dal frontend ed effettuare il salvataggio.
- Verificare che l'immagine compaia nella cartella corrispondente (es. `/BillSnap/Receipts`) all'interno del proprio Google Drive.
