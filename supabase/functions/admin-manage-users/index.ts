import { handleCors } from '../_shared/cors.ts';
import { getServiceClient, getAuthenticatedUser } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse } from '../_shared/response.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

async function syncSingleReceiptToDrive(supabase: any, cloudSetting: any, receipt: any) {
  try {
    let { access_token, refresh_token, expires_at } = cloudSetting.credentials;
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

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

    if (!access_token) return false;

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('receipts-images')
      .download(receipt.image_path);

    if (downloadError || !fileData) {
      console.error('Error downloading image for Drive sync:', downloadError);
      await supabase.from('receipts').update({ cloud_sync_status: 'failed' }).eq('id', receipt.id);
      return false;
    }

    const fileBuffer = await fileData.arrayBuffer();
    const fileName = `${receipt.receipt_date || 'nodate'}_${(receipt.vendor_name || 'ricevuta').replace(/[^a-zA-Z0-9]/g, '_')}_${receipt.id.substring(0, 8)}.jpg`;

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
        .eq('id', receipt.id);
      return true;
    } else {
      await supabase.from('receipts').update({ cloud_sync_status: 'failed' }).eq('id', receipt.id);
      return false;
    }
  } catch (err) {
    console.error('Error in syncSingleReceiptToDrive:', err);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const allowed = await checkRateLimit(req, 'admin-manage-users');
  if (!allowed) {
    return errorResponse(req, 'Troppe richieste. Attendi un minuto e riprova', 429, 'RATE_LIMIT_EXCEEDED');
  }

  try {
    const user = await getAuthenticatedUser(req);
    const supabase = getServiceClient();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'Admin') {
        return errorResponse(req, 'Accesso negato. Riservato agli Amministratori', 403, 'FORBIDDEN');
      }
    }

    const body = await req.json().catch(() => ({ action: 'list' }));
    const action = body.action || 'list';

    if (action === 'list') {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        return errorResponse(req, 'Errore nel recupero della lista utenti', 500, 'DB_ERROR');
      }

      return jsonResponse(req, { users: profiles || [] });
    }

    if (action === 'update_role') {
      const { target_user_id, new_role } = body;
      if (!target_user_id || !new_role) {
        return errorResponse(req, 'target_user_id e new_role obbligatori', 400, 'BAD_REQUEST');
      }

      if (new_role !== 'Admin' && new_role !== 'Operatore') {
        return errorResponse(req, 'Ruolo non valido (ammessi: Admin, Operatore)', 400, 'INVALID_ROLE');
      }

      const { data: updated, error } = await supabase
        .from('profiles')
        .update({ role: new_role, updated_at: new Date().toISOString() })
        .eq('id', target_user_id)
        .select()
        .single();

      if (error) {
        console.error('Error updating role:', error);
        return errorResponse(req, 'Errore nell\'aggiornamento del ruolo utente', 500, 'UPDATE_FAILED');
      }

      return jsonResponse(req, { success: true, profile: updated });
    }

    if (action === 'get_cloud_settings') {
      const { data, error } = await supabase
        .from('cloud_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching cloud settings:', error);
        return errorResponse(req, 'Errore nel caricamento delle impostazioni cloud', 500, 'DB_ERROR');
      }

      return jsonResponse(req, { cloud_settings: data || null });
    }

    if (action === 'update_cloud_settings') {
      const { provider, backup_path, backup_folder_id, is_active } = body;
      if (!provider) {
        return errorResponse(req, 'provider obbligatorio', 400, 'BAD_REQUEST');
      }

      const { data: existing, error: checkError } = await supabase
        .from('cloud_settings')
        .select('id, credentials')
        .limit(1)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing cloud settings:', checkError);
        return errorResponse(req, 'Errore nel database', 500, 'DB_ERROR');
      }

      const updatedCredentials = {
        ...(existing?.credentials || {}),
        backup_folder_id: backup_folder_id || existing?.credentials?.backup_folder_id || null,
      };

      let result;
      if (existing) {
        result = await supabase
          .from('cloud_settings')
          .update({
            provider,
            backup_path: backup_path || '',
            credentials: updatedCredentials,
            is_active: !!is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('cloud_settings')
          .insert({
            provider,
            backup_path: backup_path || '',
            is_active: !!is_active,
            credentials: updatedCredentials
          })
          .select()
          .single();
      }

      if (result.error) {
        console.error('Error upserting cloud settings:', result.error);
        return errorResponse(req, 'Errore nel salvataggio delle impostazioni cloud', 500, 'DB_ERROR');
      }

      return jsonResponse(req, { success: true, cloud_settings: result.data });
    }

    if (action === 'list_drive_folders') {
      const { data: cloudSetting } = await supabase
        .from('cloud_settings')
        .select('*')
        .eq('provider', 'drive')
        .limit(1)
        .maybeSingle();

      if (!cloudSetting || !cloudSetting.credentials || !cloudSetting.credentials.access_token) {
        return jsonResponse(req, { folders: [] });
      }

      let { access_token, refresh_token, expires_at } = cloudSetting.credentials;
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

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

      const driveResp = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=mimeType%3D'application%2Fvnd.google-apps.folder'+and+trashed%3Dfalse&fields=files(id%2Cname%2Cparents)&pageSize=100",
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );

      const driveData = await driveResp.json();

      if (driveData.error) {
        console.error('Error querying Google Drive API:', driveData);
        return jsonResponse(req, { folders: [], error: driveData.error.message });
      }

      const rawFiles: Array<{ id: string; name: string; parents?: string[] }> = driveData.files || [];
      const folderMap = new Map<string, { id: string; name: string; parents?: string[] }>();
      rawFiles.forEach(f => folderMap.set(f.id, f));

      const getFullPath = (f: { id: string; name: string; parents?: string[] }): string => {
        const parts: string[] = [f.name];
        let curr = f;
        let depth = 0;
        while (curr.parents && curr.parents.length > 0 && depth < 5) {
          const parentId = curr.parents[0];
          const parentFolder = folderMap.get(parentId);
          if (parentFolder) {
            parts.unshift(parentFolder.name);
            curr = parentFolder;
          } else {
            break;
          }
          depth++;
        }
        return '/' + parts.join('/');
      };

      const folders = rawFiles.map((f) => ({
        id: f.id,
        name: f.name,
        path: getFullPath(f),
      }));

      return jsonResponse(req, { folders });
    }

    if (action === 'create_drive_folder') {
      const { folder_name } = body;
      if (!folder_name) {
        return errorResponse(req, 'folder_name obbligatorio', 400, 'BAD_REQUEST');
      }

      const { data: cloudSetting } = await supabase
        .from('cloud_settings')
        .select('*')
        .eq('provider', 'drive')
        .limit(1)
        .maybeSingle();

      if (!cloudSetting || !cloudSetting.credentials || !cloudSetting.credentials.access_token) {
        return errorResponse(req, 'Google Drive non collegato', 400, 'NOT_CONNECTED');
      }

      let { access_token } = cloudSetting.credentials;

      const createResp = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: folder_name,
          mimeType: 'application/vnd.google-apps.folder',
        }),
      });

      const folderData = await createResp.json();
      if (folderData.id) {
        return jsonResponse(req, {
          success: true,
          folder: {
            id: folderData.id,
            name: folderData.name,
            path: `/${folderData.name}`,
          },
        });
      } else {
        return errorResponse(req, 'Errore nella creazione della cartella su Google Drive', 500, 'DRIVE_ERROR');
      }
    }

    if (action === 'list_unsynced_receipts') {
      const { data: unsynced, error } = await supabase
        .from('receipts')
        .select('id, vendor_name, total_amount, receipt_date, cloud_sync_status, created_at')
        .neq('cloud_sync_status', 'synced')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching unsynced receipts:', error);
        return errorResponse(req, 'Errore nel recupero ricevute non sincronizzate', 500, 'DB_ERROR');
      }

      return jsonResponse(req, { unsynced: unsynced || [] });
    }

    if (action === 'retry_cloud_sync') {
      const { receipt_id } = body;
      const { data: cloudSetting } = await supabase
        .from('cloud_settings')
        .select('*')
        .eq('provider', 'drive')
        .limit(1)
        .maybeSingle();

      if (!cloudSetting || !cloudSetting.credentials) {
        return errorResponse(req, 'Google Drive non collegato', 400, 'DRIVE_NOT_CONNECTED');
      }

      let query = supabase
        .from('receipts')
        .select('*')
        .neq('cloud_sync_status', 'synced')
        .neq('status', 'deleted');

      if (receipt_id) {
        query = query.eq('id', receipt_id);
      }

      const { data: targets, error: targetErr } = await query;
      if (targetErr || !targets) {
        return errorResponse(req, 'Nessuna ricevuta da risincronizzare', 404, 'NOT_FOUND');
      }

      let syncedCount = 0;
      for (const item of targets) {
        const ok = await syncSingleReceiptToDrive(supabase, cloudSetting, item);
        if (ok) syncedCount++;
      }

      return jsonResponse(req, { success: true, processed: targets.length, synced: syncedCount });
    }

    return errorResponse(req, 'Azione non riconosciuta', 400, 'INVALID_ACTION');
  } catch (err) {
    console.error('admin-manage-users error:', err);
    return errorResponse(req, 'Errore interno del server', 500, 'INTERNAL_ERROR');
  }
});
