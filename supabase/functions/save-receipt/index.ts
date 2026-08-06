import { handleCors } from '../_shared/cors.ts';
import { getServiceClient, getAuthenticatedUser } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse } from '../_shared/response.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

// Helper per sincronizzare in background su Google Drive
async function syncToGoogleDrive(receiptId: string, imagePath: string, vendorName: string, receiptDate: string) {
  try {
    const supabase = getServiceClient();
    const { data: cloudSetting } = await supabase
      .from('cloud_settings')
      .select('*')
      .eq('is_active', true)
      .eq('provider', 'drive')
      .maybeSingle();

    if (!cloudSetting || !cloudSetting.credentials) {
      return;
    }

    let { access_token, refresh_token, expires_at } = cloudSetting.credentials;
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    // Se il token è scaduto, lo rinnoviamo
    if (expires_at && Date.now() >= expires_at - 60000 && refresh_token && clientId && clientSecret) {
      const refreshResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      const refreshData = await refreshResp.json();
      if (refreshData.access_token) {
        access_token = refreshData.access_token;
        const newCredentials = {
          ...cloudSetting.credentials,
          access_token,
          expires_at: Date.now() + (refreshData.expires_in * 1000),
        };
        await supabase
          .from('cloud_settings')
          .update({ credentials: newCredentials, updated_at: new Date().toISOString() })
          .eq('id', cloudSetting.id);
      }
    }

    if (!access_token) return;

    // Scarica l'immagine dal bucket Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('receipts-images')
      .download(imagePath);

    if (downloadError || !fileData) {
      console.error('Error downloading image for Drive sync:', downloadError);
      await supabase.from('receipts').update({ cloud_sync_status: 'failed' }).eq('id', receiptId);
      return;
    }

    const fileBuffer = await fileData.arrayBuffer();
    const fileName = `${receiptDate}_${vendorName.replace(/[^a-zA-Z0-9]/g, '_')}_${receiptId.substring(0, 8)}.jpg`;

    // Cerca se esiste la cartella specificata per spostarci l'immagine
    let parentFolderId: string | undefined = cloudSetting.credentials?.backup_folder_id || undefined;
    if (!parentFolderId && cloudSetting.backup_path) {
      const folderNameClean = cloudSetting.backup_path.replace(/^\/+|\/+$/g, '').split('/').pop();
      if (folderNameClean) {
        const searchResp = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=mimeType%3D'application%2Fvnd.google-apps.folder'+and+name%3D'${encodeURIComponent(folderNameClean)}'+and+trashed%3Dfalse`,
          { headers: { Authorization: `Bearer ${access_token}` } }
        );
        const searchData = await searchResp.json();
        if (searchData.files && searchData.files.length > 0) {
          parentFolderId = searchData.files[0].id;
        }
      }
    }

    // Multipart upload a Google Drive API
    const metadata: Record<string, any> = {
      name: fileName,
      mimeType: 'image/jpeg',
    };

    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    const boundary = 'foo_bar_baz';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataHeaders = 'Content-Type: application/json; charset=UTF-8\r\n\r\n';
    const mediaHeaders = 'Content-Type: image/jpeg\r\n\r\n';

    const enc = new TextEncoder();
    const part1 = enc.encode(delimiter + metadataHeaders + JSON.stringify(metadata) + delimiter + mediaHeaders);
    const part2 = new Uint8Array(fileBuffer);
    const part3 = enc.encode(closeDelimiter);

    const fullBody = new Uint8Array(part1.length + part2.length + part3.length);
    fullBody.set(part1, 0);
    fullBody.set(part2, part1.length);
    fullBody.set(part3, part1.length + part2.length);

    const driveResp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullBody,
    });

    const driveData = await driveResp.json();
    if (driveData.id) {
      await supabase
        .from('receipts')
        .update({
          cloud_sync_status: 'synced',
          cloud_file_id: driveData.id,
          cloud_file_url: `https://drive.google.com/file/d/${driveData.id}/view`,
        })
        .eq('id', receiptId);
      console.log(`Synced to Drive: ${driveData.id}`);
    } else {
      console.error('Drive upload failed:', driveData);
      await supabase.from('receipts').update({ cloud_sync_status: 'failed' }).eq('id', receiptId);
    }
  } catch (err) {
    console.error('Background sync to Google Drive error:', err);
  }
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const allowed = await checkRateLimit(req, 'save-receipt');
  if (!allowed) {
    return errorResponse(req, 'Troppe richieste di salvataggio. Riprova tra un minuto', 429, 'RATE_LIMIT_EXCEEDED');
  }

  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json();

    const {
      vendor_name,
      total_amount,
      receipt_date,
      category,
      payment_method,
      tax_amount,
      vat_amount,
      currency,
      status,
      image_path,
      raw_ocr_json,
      raw_ai_response,
      notes,
      group_id,
    } = body;

    if (!vendor_name || total_amount === undefined || !receipt_date || !category || !image_path) {
      return errorResponse(
        req,
        'Campi obbligatori mancanti: vendor_name, total_amount, receipt_date, category, image_path',
        400,
        'BAD_REQUEST'
      );
    }

    const numericAmount = parseFloat(total_amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return errorResponse(req, 'total_amount deve essere un numero valido >= 0', 400, 'INVALID_AMOUNT');
    }

    // Gestione sicura UUID per group_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const cleanGroupId = (group_id && typeof group_id === 'string' && uuidRegex.test(group_id)) ? group_id : null;
    const cleanUserId = (user && user.id && uuidRegex.test(user.id)) ? user.id : null;

    const parsedTax = tax_amount !== undefined && tax_amount !== null && tax_amount !== '' ? parseFloat(tax_amount) : (vat_amount !== undefined && vat_amount !== null && vat_amount !== '' ? parseFloat(vat_amount) : null);

    const supabase = getServiceClient();

    // Controllo duplicati per utente corrente
    if (cleanUserId) {
      const { data: existingDuplicate } = await supabase
        .from('receipts')
        .select('id, vendor_name, receipt_date, total_amount')
        .eq('user_id', cleanUserId)
        .eq('vendor_name', vendor_name)
        .eq('receipt_date', receipt_date)
        .eq('total_amount', numericAmount)
        .maybeSingle();

      if (existingDuplicate) {
        console.warn(`Duplicate receipt detected for user ${cleanUserId}: receipt ID ${existingDuplicate.id}`);
      }
    }

    const receiptPayload: Record<string, any> = {
      vendor_name,
      total_amount: numericAmount,
      receipt_date,
      category,
      payment_method: payment_method || null,
      vat_amount: parsedTax,
      currency: currency || 'EUR',
      status: status || 'completed',
      image_path,
      raw_ai_response: raw_ocr_json || raw_ai_response || {},
      notes: notes || null,
      cloud_sync_status: 'pending',
      user_id: cleanUserId,
      group_id: cleanGroupId,
    };

    const { data: newReceipt, error: dbError } = await supabase
      .from('receipts')
      .insert(receiptPayload)
      .select()
      .single();

    if (dbError) {
      console.error('Error inserting receipt:', dbError);
      return errorResponse(req, `Errore nel salvataggio della ricevuta nel database: ${dbError.message}`, 500, 'DB_INSERT_FAILED');
    }

    // Sincronizzazione automatica Google Drive in background
    syncToGoogleDrive(newReceipt.id, image_path, vendor_name, receipt_date);

    return jsonResponse(req, {
      success: true,
      receipt: newReceipt,
    });
  } catch (err: any) {
    console.error('save-receipt error:', err);
    return errorResponse(req, `Errore interno durante il salvataggio della ricevuta: ${err.message || String(err)}`, 500, 'INTERNAL_ERROR');
  }
});
