import { handleCors } from '../_shared/cors.ts';
import { getServiceClient, getAuthenticatedUser } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse } from '../_shared/response.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const allowed = await checkRateLimit(req, 'delete-receipt');
  if (!allowed) {
    return errorResponse(req, 'Troppe richieste. Attendi un minuto e riprova', 429, 'RATE_LIMIT_EXCEEDED');
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return errorResponse(req, 'Utente non autenticato. Accesso negato.', 401, 'UNAUTHORIZED');
    }

    const { id } = await req.json();

    if (!id) return errorResponse(req, 'ID mancante', 400, 'ID_MISSING');

    const supabase = getServiceClient();

    // 1. Recupera record per ottenere path file (assicurando la proprietà dell'utente)
    const { data: receipt, error: selectError } = await supabase
      .from('receipts')
      .select('image_path, thumbnail_path')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (selectError || !receipt) {
      return errorResponse(req, 'Ricevuta non trovata', 404, 'RECEIPT_NOT_FOUND');
    }

    // 2. Elimina file da Storage (best-effort — non blocca se fallisce)
    const filesToDelete: string[] = [receipt.image_path];
    if (receipt.thumbnail_path && receipt.thumbnail_path !== receipt.image_path) {
      filesToDelete.push(receipt.thumbnail_path);
    }

    const { error: storageError } = await supabase.storage
      .from('receipts-images')
      .remove(filesToDelete);

    if (storageError) {
      // Non bloccante: logga ma prosegui con la cancellazione del record
      console.warn('Storage delete warning (non-blocking):', storageError);
    }

    // 3. Elimina record da DB (sicuro)
    const { error: deleteError } = await supabase
      .from('receipts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return errorResponse(req, "Errore durante l'eliminazione", 500, 'DELETE_FAILED');
    }

    console.log(`Deleted receipt: ${id}`);

    return jsonResponse(req, { success: true });
  } catch (err) {
    console.error('delete-receipt error:', err);
    return errorResponse(req, 'Errore interno del server', 500, 'INTERNAL_ERROR');
  }
});
