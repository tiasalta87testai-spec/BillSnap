# BillSnap — Script di Deploy Edge Functions
# Esegui con: powershell -ExecutionPolicy Bypass -File deploy.ps1
# Prerequisiti: supabase CLI installata e login effettuato (supabase login)

$PROJECT_ID = "kkuitfbewuxrkysvvxyz"
$PROJECT_DIR = $PSScriptRoot

Write-Host "`n=== BillSnap — Deploy Backend ===" -ForegroundColor Cyan
Write-Host "Project ID: $PROJECT_ID`n"

# 1. Link al progetto
Write-Host "[1/4] Linking al progetto Supabase..." -ForegroundColor Yellow
supabase link --project-ref $PROJECT_ID --workdir $PROJECT_DIR

# 2. Imposta i secrets (inserisci i tuoi valori)
Write-Host "`n[2/4] Impostazione secrets..." -ForegroundColor Yellow
Write-Host "  - GEMINI_API_KEY e ALLOWED_ORIGINS devono essere impostati manualmente:"
Write-Host "    supabase secrets set GEMINI_API_KEY=AIza... --project-ref $PROJECT_ID"
Write-Host "    supabase secrets set GEMINI_MODEL=gemini-2.5-flash --project-ref $PROJECT_ID"
Write-Host "    supabase secrets set ALLOWED_ORIGINS=https://billsnap.vercel.app,http://localhost:3000 --project-ref $PROJECT_ID"
Write-Host ""

# Decommenta le righe sotto dopo aver inserito le tue chiavi:
# supabase secrets set GEMINI_API_KEY=AIza... --project-ref $PROJECT_ID
# supabase secrets set GEMINI_MODEL=gemini-2.5-flash --project-ref $PROJECT_ID
# supabase secrets set ALLOWED_ORIGINS=https://billsnap.vercel.app,http://localhost:3000 --project-ref $PROJECT_ID

# 3. Deploy delle Edge Functions
Write-Host "[3/4] Deploy Edge Functions..." -ForegroundColor Yellow

$functions = @("upload-image", "analyze-receipt", "save-receipt", "delete-receipt", "get-signed-url")
foreach ($fn in $functions) {
    Write-Host "  -> Deploying $fn..."
    supabase functions deploy $fn --project-ref $PROJECT_ID --workdir $PROJECT_DIR
}

# 4. Verifica
Write-Host "`n[4/4] Deploy completato!" -ForegroundColor Green
Write-Host ""
Write-Host "Endpoints Edge Functions:" -ForegroundColor Cyan
foreach ($fn in $functions) {
    Write-Host "  https://kkuitfbewuxrkysvvxyz.supabase.co/functions/v1/$fn"
}

Write-Host ""
Write-Host "Dashboard Supabase: https://supabase.com/dashboard/project/$PROJECT_ID" -ForegroundColor Cyan
Write-Host ""
