'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { UserProfile, UserRole } from '@/lib/types';
import { ShieldCheck, Users, Cloud, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Folder, Plus } from 'lucide-react';

export default function AdminPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [cloudActive, setCloudActive] = useState(false);
  const [cloudProvider, setCloudProvider] = useState<'drive' | 'dropbox' | 'onedrive' | 'icloud'>('drive');
  const [backupPath, setBackupPath] = useState('/BillSnap/Receipts');
  const [backupFolderId, setBackupFolderId] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudMessage, setCloudMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [driveFolders, setDriveFolders] = useState<Array<{ id: string; name: string; path: string }>>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [customPathMode, setCustomPathMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminListUsers();
      setUsers(res.users || []);
    } catch (err: unknown) {
      console.error('Error fetching admin users:', err);
      setError('Impossibile caricare la lista utenti. Assicurati di essere collegato come Admin.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCloudSettings = async () => {
    try {
      const res = await api.adminGetCloudSettings();
      if (res.cloud_settings) {
        setCloudProvider(res.cloud_settings.provider);
        setBackupPath(res.cloud_settings.backup_path || '/BillSnap/Receipts');
        setCloudActive(res.cloud_settings.is_active);
        const creds = res.cloud_settings.credentials;
        if (creds?.backup_folder_id) {
          setBackupFolderId(creds.backup_folder_id);
        }
        const connected = Boolean(creds && (creds.access_token || creds.refresh_token || Object.keys(creds).length > 0));
        setHasCredentials(connected);
        if (connected && res.cloud_settings.provider === 'drive') {
          loadDriveFolders();
        }
      }
    } catch (err) {
      console.error('Error fetching cloud settings:', err);
    }
  };

  const loadDriveFolders = async () => {
    setLoadingFolders(true);
    try {
      const res = await api.adminListDriveFolders();
      setDriveFolders(res.folders || []);
    } catch (err) {
      console.error('Error loading Drive folders:', err);
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      const res = await api.adminCreateDriveFolder(newFolderName.trim());
      if (res.success && res.folder) {
        setDriveFolders(prev => [...prev, res.folder]);
        setBackupPath(res.folder.path);
        setBackupFolderId(res.folder.id);
        setNewFolderName('');
        setCustomPathMode(false);
        setCloudMessage({ text: `Cartella "${res.folder.name}" creata con successo su Google Drive!`, isError: false });
      }
    } catch (err: any) {
      console.error('Error creating folder:', err);
      setCloudMessage({ text: err.message || 'Errore nella creazione della cartella', isError: true });
    } finally {
      setIsCreatingFolder(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCloudSettings();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('status') === 'drive_connected') {
        setCloudMessage({ text: 'Account Google Drive collegato ed autorizzato con successo! 🎉', isError: false });
        loadDriveFolders();
      } else if (params.get('error')) {
        setCloudMessage({ text: 'Errore durante l\'autenticazione Google Drive.', isError: true });
      }
    }
  }, []);

  const handleRoleChange = async (userId: string, currentRole: UserRole) => {
    const newRole: UserRole = currentRole === 'Admin' ? 'Operatore' : 'Admin';
    setUpdatingId(userId);
    try {
      await api.adminUpdateUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err: unknown) {
      console.error('Error updating role:', err);
      alert('Errore nell\'aggiornamento del ruolo');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveCloudSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setCloudLoading(true);
    setCloudMessage(null);
    try {
      const res = await api.adminUpdateCloudSettings(cloudProvider, backupPath, cloudActive, undefined, backupFolderId || undefined);
      if (res.success) {
        setCloudMessage({ text: 'Configurazione cloud salvata con successo!', isError: false });
      }
    } catch (err: any) {
      console.error('Error saving cloud settings:', err);
      setCloudMessage({ text: err.message || 'Errore nel salvataggio delle impostazioni cloud', isError: true });
    } finally {
      setCloudLoading(false);
    }
  };

  const handleConnectDrive = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kkuitfbewuxrkysvvxyz.supabase.co';
    const authUrl = `${supabaseUrl}/functions/v1/auth-cloud?action=authorize`;
    window.location.href = authUrl;
  };

  return (
    <div style={{ paddingBottom: '80px' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck style={{ color: 'var(--color-primary, #60a5fa)' }} />
          Pannello Amministrazione
        </h1>
        <p style={{ color: 'var(--color-secondary, #94a3b8)', margin: 0, fontSize: '14px' }}>
          Gestione utenti, ruoli e backup automatico cloud
        </p>
      </header>

      {/* SEZIONE GESTIONE UTENTI */}
      <section style={{ background: 'var(--color-surface-container, #131d33)', padding: '20px', borderRadius: '14px', border: '1px solid var(--color-border-card, #1e293b)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} style={{ color: '#60a5fa' }} />
            Gestione Utenti e Ruoli ({users.length})
          </h2>
          <button
            onClick={fetchUsers}
            style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Aggiorna
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--color-secondary, #94a3b8)', fontSize: '14px' }}>Caricamento utenti...</p>
        ) : error ? (
          <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', fontSize: '13px' }}>
            <AlertCircle size={16} style={{ display: 'inline', marginRight: '6px' }} />
            {error}
          </div>
        ) : users.length === 0 ? (
          <p style={{ color: 'var(--color-secondary, #94a3b8)', fontSize: '14px' }}>Nessun utente registrato o sistema in modalità dev anonima.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {users.map((u) => (
              <div
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-on-surface, #f1f5f9)' }}>
                    {u.email}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-secondary, #94a3b8)', marginTop: '2px' }}>
                    Iscritto il: {new Date(u.created_at).toLocaleDateString('it-IT')}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: '20px',
                      backgroundColor: u.role === 'Admin' ? 'rgba(37, 99, 235, 0.25)' : 'rgba(148, 163, 184, 0.15)',
                      color: u.role === 'Admin' ? '#60a5fa' : '#94a3b8',
                      border: `1px solid ${u.role === 'Admin' ? '#2563eb' : '#475569'}`,
                    }}
                  >
                    {u.role}
                  </span>

                  <button
                    disabled={updatingId === u.id}
                    onClick={() => handleRoleChange(u.id, u.role)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: 'var(--color-surface-container-high, #1c2742)',
                      color: '#f8fafc',
                      cursor: 'pointer',
                    }}
                  >
                    {updatingId === u.id ? 'Aggiornamento...' : `Cambia in ${u.role === 'Admin' ? 'Operatore' : 'Admin'}`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SEZIONE CONFIGURAZIONE BACKUP CLOUD */}
      <section style={{ background: 'var(--color-surface-container, #131d33)', padding: '20px', borderRadius: '14px', border: '1px solid var(--color-border-card, #1e293b)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cloud size={18} style={{ color: '#8b5cf6' }} />
          Backup Automatico Cloud (Google Drive)
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--color-secondary, #94a3b8)', margin: '0 0 16px 0' }}>
          Sincronizza e archivia automaticamente una copia delle immagini degli scontrini sul tuo Google Drive.
        </p>

        {/* STATUS COLLEGAMENTO DRIVE */}
        <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Stato Connessione Google Drive:
              <span style={{ color: hasCredentials ? '#10b981' : '#f59e0b', fontSize: '13px' }}>
                {hasCredentials ? '● Collegato' : '○ Non collegato'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              {hasCredentials ? 'Token di autorizzazione Google memorizzato ed attivo.' : 'Autorizza l\'accesso a Google Drive per abilitare il backup.'}
            </div>
          </div>

          <button
            type="button"
            onClick={handleConnectDrive}
            style={{
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ExternalLink size={14} />
            {hasCredentials ? 'Riconnetti Google' : 'Connetti Google Drive'}
          </button>
        </div>

        <form onSubmit={handleSaveCloudSettings} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Provider Cloud:
            </label>
            <select
              value={cloudProvider}
              onChange={(e) => setCloudProvider(e.target.value as 'drive' | 'dropbox' | 'onedrive' | 'icloud')}
              className="input"
            >
              <option value="drive">Google Drive</option>
              <option value="dropbox">Dropbox</option>
              <option value="onedrive">Microsoft OneDrive</option>
              <option value="icloud">Apple iCloud</option>
            </select>
          </div>

          {/* SELEZIONE CARTELLA GOOGLE DRIVE */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Folder size={15} style={{ color: '#60a5fa' }} />
                Cartella Backup su Drive:
              </label>
              {hasCredentials && (
                <button
                  type="button"
                  onClick={loadDriveFolders}
                  style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshCw size={12} className={loadingFolders ? 'spin' : ''} />
                  {loadingFolders ? 'Aggiornamento...' : 'Ricarica cartelle'}
                </button>
              )}
            </div>

            {hasCredentials && driveFolders.length > 0 && !customPathMode ? (
              <select
                value={backupFolderId || backupPath}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setCustomPathMode(true);
                  } else {
                    const selected = driveFolders.find(f => f.id === e.target.value || f.path === e.target.value);
                    if (selected) {
                      setBackupPath(selected.path);
                      setBackupFolderId(selected.id);
                    } else {
                      setBackupPath(e.target.value);
                    }
                  }
                }}
                className="input"
              >
                <option value="/BillSnap/Receipts">📁 /BillSnap/Receipts (Default)</option>
                {driveFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.path}
                  </option>
                ))}
                <option value="__custom__">✏️ ➕ Inserisci percorso personalizzato...</option>
              </select>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="text"
                  value={backupPath}
                  onChange={(e) => setBackupPath(e.target.value)}
                  placeholder="es: /BillSnap/Receipts"
                  className="input"
                />
                {hasCredentials && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Nome nuova cartella su Drive"
                      className="input"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      disabled={isCreatingFolder || !newFolderName.trim()}
                      onClick={handleCreateFolder}
                      style={{
                        padding: '8px 14px',
                        fontSize: '13px',
                        fontWeight: 600,
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#10b981',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Plus size={14} />
                      {isCreatingFolder ? 'Crazione...' : 'Crea in Drive'}
                    </button>
                  </div>
                )}
                {customPathMode && (
                  <button
                    type="button"
                    onClick={() => setCustomPathMode(false)}
                    style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                  >
                    &larr; Torna alla selezione da elenco cartelle Drive
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Abilita Backup Automatico</div>
              <div style={{ fontSize: '12px', color: cloudActive ? '#10b981' : '#94a3b8' }}>
                {cloudActive ? 'Sincronizzazione attiva per le nuove ricevute' : 'Disattivata'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCloudActive(!cloudActive)}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                backgroundColor: cloudActive ? '#10b981' : 'var(--color-surface-container-high, #1c2742)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {cloudActive ? 'Attivo ✓' : 'Attiva Sincronizzazione'}
            </button>
          </div>

          {cloudMessage && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                background: cloudMessage.isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                border: `1px solid ${cloudMessage.isError ? '#ef4444' : '#10b981'}`,
                color: cloudMessage.isError ? '#ef4444' : '#10b981',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {cloudMessage.isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              {cloudMessage.text}
            </div>
          )}

          <button
            type="submit"
            disabled={cloudLoading}
            style={{
              padding: '12px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#8b5cf6',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '6px',
            }}
          >
            {cloudLoading ? 'Salvataggio in corso...' : 'Salva Configurazione Cloud'}
          </button>
        </form>
      </section>
    </div>
  );
}
