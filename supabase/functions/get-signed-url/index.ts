import { handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse } from '../_shared/response.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const allowed = await checkRateLimit(req, 'get-signed-url');
  if (!allowed) {
    return errorResponse(req, 'Troppe richieste. Attendi un minuto e riprova', 429, 'RATE_LIMIT_EXCEEDED');
  }

  try {
    const { image_path } = await req.json();

    if (!image_path) return errorResponse(req, 'image_path mancante', 400, 'IMAGE_PATH_MISSING');

    const supabase = getServiceClient();

    const { data, error } = await supabase.storage
      .from('receipts-images')
      .createSignedUrl(image_path, 3600); // TTL 1 ora

    if (error || !data) {
      console.error('Signed URL error:', error);
      return errorResponse(req, 'Impossibile generare URL immagine', 500, 'SIGNED_URL_FAILED');
    }

    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    return jsonResponse(req, {
      signed_url: data.signedUrl,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error('get-signed-url error:', err);
    return errorResponse(req, 'Errore interno del server', 500, 'INTERNAL_ERROR');
  }
});
