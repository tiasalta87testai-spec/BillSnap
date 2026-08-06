# BillSnap — Backend Walkthrough (V2 Advanced)

> Documento aggiornato al 2026-08-05 con funzionalità avanzate V2

---

## Progetto Supabase

| Campo | Valore |
|---|---|
| **Project ID** | `kkuitfbewuxrkysvvxyz` |
| **Nome** | `billsnap` |
| **Region** | `eu-central-1` |
| **URL** | `https://kkuitfbewuxrkysvvxyz.supabase.co` |
| **Dashboard** | https://supabase.com/dashboard/project/kkuitfbewuxrkysvvxyz |

---

## Schema Database V2

### Tabelle

1. **`profiles`**: Profilazione utenti (`email`, `first_name`, `last_name`, `role` enum `Admin` | `Operatore`). Trigger `handle_new_user` su `auth.users` che assegna il ruolo `Admin` al primo utente registrato.
2. **`receipt_groups`**: Gruppi e faldoni di spesa (`name`, `description`, `color`, `user_id`).
3. **`receipts`**: Tabella principale scontrini aggiornata con `group_id`, `cloud_sync_status` (`pending`, `synced`, `failed`), `cloud_file_id`, `cloud_file_url`.
4. **`cloud_settings`**: Configurazione backup cloud per Amministratori (`provider` enum `drive`, `dropbox`, `icloud`, `onedrive`, `credentials`, `backup_path`, `is_active`).
5. **`rate_limits`**: Rate limiting per Edge Functions basato su IP.

---

## Edge Functions Deployate (7 totali)

URL Base: `https://kkuitfbewuxrkysvvxyz.supabase.co/functions/v1/`

| Funzione | Endpoint | Metodo | Scopo |
|---|---|---|---|
| `upload-image` | `/upload-image` | POST multipart | Upload su Storage (supporta path utente `{user_id}/{anno}/{mese}/{uuid}.ext`) |
| `analyze-receipt` | `/analyze-receipt` | POST JSON | Estrazione AI tramite Gemini Flash 2.5 |
| `save-receipt` | `/save-receipt` | POST JSON | Salvataggio ricevuta con check duplicati per utente e `group_id` |
| `delete-receipt` | `/delete-receipt` | POST JSON | Eliminazione da DB e Storage |
| `get-signed-url` | `/get-signed-url` | POST JSON | Genera signed URL temporaneo (TTL 1 ora) |
| **`get-user-stats`** *(Nuova V2)* | `/get-user-stats` | POST JSON | Calcola totale spesa, media, totale ricevute, ripartizione per Categoria, per Gruppo ed andamento mensile 12 mesi |
| **`admin-manage-users`** *(Nuova V2)* | `/admin-manage-users` | POST JSON | Riservata ad Admin: elenca utenti e consente di modificare i ruoli (`Admin` / `Operatore`) |

---

## Secrets Configurati

- `GEMINI_API_KEY`: ✅ Configurato
- `GEMINI_MODEL`: ✅ `gemini-2.5-flash`
- `ALLOWED_ORIGINS`: ✅ `https://billsnap.vercel.app,http://localhost:3000`

---

## Integrazione Frontend

File `.env.local` configurato nella root del progetto:
```env
NEXT_PUBLIC_SUPABASE_URL=https://kkuitfbewuxrkysvvxyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL=https://kkuitfbewuxrkysvvxyz.supabase.co/functions/v1
```

Metodi API disponibili in `lib/api.ts`:
- `api.uploadImage(file, userToken?)`
- `api.analyzeReceipt(imagePath, userToken?)`
- `api.saveReceipt(data, userToken?)`
- `api.deleteReceipt(id, userToken?)`
- `api.getSignedUrl(imagePath, userToken?)`
- `api.getUserStats(userToken?)`
- `api.adminListUsers(userToken?)`
- `api.adminUpdateUserRole(targetUserId, newRole, userToken?)`
