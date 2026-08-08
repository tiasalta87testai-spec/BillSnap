import { Receipt, UserStats, UserProfile } from './types';
import { supabase } from './supabase';

const EF_BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || '') + '/functions/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function callEdgeFunction<T>(name: string, body: FormData | unknown, isFormData = false, userToken?: string): Promise<T> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  // Estrae in modo trasparente l'access token dalla sessione attiva
  const { data: { session } } = await supabase.auth.getSession();
  const activeToken = userToken || session?.access_token || anonKey;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${activeToken}`,
    'apikey': anonKey,
  };
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${EF_BASE}/${name}`, {
    method: 'POST',
    headers,
    body: isFormData ? (body as FormData) : JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Errore durante la comunicazione con il server' }));
    throw new ApiError(response.status, errorData.message || `Errore HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  uploadImage: (file: File, userToken?: string) => {
    const fd = new FormData();
    fd.append('image', file);
    return callEdgeFunction<{ image_path: string; thumbnail_path: string }>('upload-image', fd, true, userToken);
  },

  analyzeReceipt: (imagePath: string, userToken?: string) =>
    callEdgeFunction<Partial<Receipt>>('analyze-receipt', { image_path: imagePath }, false, userToken),

  saveReceipt: (data: Partial<Receipt>, userToken?: string) =>
    callEdgeFunction<{ id: string; image_url?: string; is_duplicate_warning?: boolean }>('save-receipt', data, false, userToken),

  deleteReceipt: (id: string, userToken?: string) =>
    callEdgeFunction<{ success: boolean }>('delete-receipt', { id }, false, userToken),

  getSignedUrl: (imagePath: string, userToken?: string) =>
    callEdgeFunction<{ signed_url: string; expires_at: string }>('get-signed-url', { image_path: imagePath }, false, userToken),

  getUserStats: (userToken?: string) =>
    callEdgeFunction<UserStats>('get-user-stats', {}, false, userToken),

  adminListUsers: (userToken?: string) =>
    callEdgeFunction<{ users: UserProfile[] }>('admin-manage-users', { action: 'list' }, false, userToken),

  adminUpdateUserRole: (targetUserId: string, newRole: 'Admin' | 'Operatore', userToken?: string) =>
    callEdgeFunction<{ success: boolean; profile: UserProfile }>('admin-manage-users', { action: 'update_role', target_user_id: targetUserId, new_role: newRole }, false, userToken),

  adminGetCloudSettings: (userToken?: string) =>
    callEdgeFunction<{ cloud_settings: { provider: 'drive' | 'dropbox' | 'onedrive' | 'icloud'; backup_path: string; is_active: boolean; credentials?: Record<string, any> } | null }>('admin-manage-users', { action: 'get_cloud_settings' }, false, userToken),

  adminUpdateCloudSettings: (provider: 'drive' | 'dropbox' | 'onedrive' | 'icloud', backupPath: string, isActive: boolean, userToken?: string, backupFolderId?: string) =>
    callEdgeFunction<{ success: boolean; cloud_settings: any }>('admin-manage-users', { action: 'update_cloud_settings', provider, backup_path: backupPath, backup_folder_id: backupFolderId, is_active: isActive }, false, userToken),

  adminListDriveFolders: (userToken?: string) =>
    callEdgeFunction<{ folders: Array<{ id: string; name: string; path: string }> }>('admin-manage-users', { action: 'list_drive_folders' }, false, userToken),

  adminCreateDriveFolder: (folderName: string, userToken?: string) =>
    callEdgeFunction<{ success: boolean; folder: { id: string; name: string; path: string } }>('admin-manage-users', { action: 'create_drive_folder', folder_name: folderName }, false, userToken),

  adminListUnsyncedReceipts: (userToken?: string) =>
    callEdgeFunction<{ unsynced: Array<{ id: string; vendor_name: string; total_amount: number; receipt_date: string; cloud_sync_status: string; created_at: string }> }>('admin-manage-users', { action: 'list_unsynced_receipts' }, false, userToken),

  adminRetryCloudSync: (receiptId?: string, userToken?: string) =>
    callEdgeFunction<{ success: boolean; processed: number; synced: number }>('admin-manage-users', { action: 'retry_cloud_sync', receipt_id: receiptId }, false, userToken),
};
