import { handleCors } from '../_shared/cors.ts';
import { getServiceClient, getAuthenticatedUser } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse } from '../_shared/response.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

Deno.serve(async (req: Request) => {
  // CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Rate limiting
  const allowed = await checkRateLimit(req, 'upload-image');
  if (!allowed) {
    return errorResponse(req, 'Troppe richieste. Attendi un minuto e riprova', 429, 'RATE_LIMIT_EXCEEDED');
  }

  try {
    const user = await getAuthenticatedUser(req);

    // 1. Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return errorResponse(req, 'Immagine mancante', 400, 'IMAGE_MISSING');
    }

    // 2. Validazione formato
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return errorResponse(req, 'Formato non supportato. Usa JPG, PNG o WebP', 400, 'INVALID_FORMAT');
    }

    // 3. Validazione dimensione (max 5 MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return errorResponse(req, 'File troppo grande. Dimensione massima: 5 MB', 400, 'FILE_TOO_LARGE');
    }

    // 4. Genera path univoco (prefissato con user_id se utente loggato)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uuid = crypto.randomUUID();
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';

    const userPrefix = user ? `${user.id}/` : '';
    const imagePath = `${userPrefix}${year}/${month}/${uuid}.${ext}`;
    const thumbnailPath = `${userPrefix}thumbs/${year}/${month}/${uuid}_thumb.${ext}`;

    // 5. Upload su Storage
    const supabase = getServiceClient();
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('receipts-images')
      .upload(imagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return errorResponse(req, 'Errore durante il caricamento', 500, 'UPLOAD_FAILED');
    }

    console.log(`Uploaded: ${imagePath}`);

    return jsonResponse(req, {
      image_path: imagePath,
      thumbnail_path: thumbnailPath,
    });
  } catch (err) {
    console.error('upload-image error:', err);
    return errorResponse(req, 'Errore interno del server', 500, 'INTERNAL_ERROR');
  }
});
