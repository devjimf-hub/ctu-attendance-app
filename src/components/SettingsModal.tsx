import React, { useState } from 'react';
import {
  X,
  Settings,
  Cloud,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Database,
  Smartphone,
  Check
} from 'lucide-react';
import { SyncStatus } from '../types';
import { storageService } from '../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus;
  onSyncRefresh: () => void;
  canInstallPwa?: boolean;
  onInstallPwa?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  onSyncRefresh,
  canInstallPwa,
  onInstallPwa
}) => {
  const [syncingNow, setSyncingNow] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  if (!isOpen) return null;

  const handleManualSync = async () => {
    setSyncingNow(true);
    try {
      await storageService.syncWithFirebase();
      setSyncSuccess(true);
      onSyncRefresh();
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (e) {
      console.error('Manual sync failed:', e);
    } finally {
      setSyncingNow(false);
    }
  };

  const handleExportBackup = () => {
    const jsonStr = storageService.exportFullBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ClassCheck_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      if (content) {
        const success = storageService.importFullBackupJSON(content);
        if (success) {
          alert('Backup restored successfully!');
          onSyncRefresh();
          onClose();
        } else {
          alert('Failed to parse backup file. Please ensure it is a valid JSON backup.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (confirm('Are you sure you want to reset and reload default demo college classes?')) {
      storageService.resetAllData();
      onSyncRefresh();
      onClose();
    }
  };

  const formattedLastSync = syncStatus.lastSyncedAt
    ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Not yet synced';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="modal-icon-badge">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="modal-title">System & Cloud Sync</h3>
              <p className="modal-subtitle">Cloud synchronization status & local backups</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Cloud Sync Status Card */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: syncStatus.firebaseConnected ? 'var(--status-present-bg)' : 'var(--bg-card)',
                    color: syncStatus.firebaseConnected ? 'var(--status-present)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Cloud size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span>Cloud Sync</span>
                    <span
                      className={`badge ${syncStatus.firebaseConnected ? 'badge-present' : 'badge-excused'}`}
                      style={{ fontSize: '0.72rem', padding: '0.12rem 0.45rem' }}
                    >
                      {syncStatus.firebaseConnected ? 'Connected' : 'Offline Mode'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {syncStatus.isOnline
                      ? '🟢 Internet active'
                      : '🟠 Working offline (IndexedDB)'}
                  </div>
                </div>
              </div>

              <button
                className="btn btn-sm btn-primary"
                onClick={handleManualSync}
                disabled={syncingNow || syncStatus.isSyncing}
                style={{ flexShrink: 0 }}
              >
                <RefreshCw size={13} className={syncingNow || syncStatus.isSyncing ? 'spin-animate' : ''} />
                {syncingNow || syncStatus.isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>

            <div
              className="form-row-2col"
              style={{
                paddingTop: '0.65rem',
                borderTop: '1px solid var(--border-color)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)'
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Pending queue: </span>
                <strong>{syncStatus.pendingChangesCount} change{syncStatus.pendingChangesCount === 1 ? '' : 's'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Last synced: </span>
                <strong>{formattedLastSync}</strong>
              </div>
            </div>

            {syncSuccess && (
              <div style={{ fontSize: '0.8rem', color: 'var(--status-present)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCircle2 size={14} /> Cloud synchronization completed successfully!
              </div>
            )}
          </div>

          {/* Security & Infrastructure Info */}
          <div
            style={{
              padding: '0.9rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary-light)',
              border: '1px solid rgba(26, 115, 232, 0.15)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem'
            }}
          >
            <ShieldCheck size={18} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
              <strong>Secure Cloud Infrastructure</strong>
              <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)' }}>
                Firebase credentials are encrypted and managed securely via server-side environment configuration. Raw credentials and API keys are hidden from the frontend to protect system integrity.
              </p>
            </div>
          </div>

          {/* Progressive Web App (PWA) Install Section */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Smartphone size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span>Install Class Check App</span>
                    {typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) && (
                      <span
                        className="badge badge-present"
                        style={{ fontSize: '0.72rem', padding: '0.12rem 0.45rem' }}
                      >
                        <Check size={11} /> Installed (App Mode)
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0', lineHeight: 1.4 }}>
                    {typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true)
                      ? 'You are running Class Check as an installed application with offline caching and faster access.'
                      : 'Install to your device home screen for instant offline attendance, full-screen view, and native app performance.'}
                  </p>
                </div>
              </div>

              {onInstallPwa && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={onInstallPwa}
                  style={{ flexShrink: 0, marginTop: '2px' }}
                >
                  <Download size={14} />
                  Install App
                </button>
              )}
            </div>

            {!canInstallPwa && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--border-color)',
                  lineHeight: 1.4
                }}
              >
                💡 <em>Tip: To install on iOS Safari, tap <strong>Share</strong> (⎋) → <strong>Add to Home Screen</strong>. On Android Chrome, tap <strong>⋮</strong> → <strong>Install app</strong>.</em>
              </div>
            )}
          </div>

          <hr style={{ borderColor: 'var(--border-color)', margin: '0' }} />

          {/* Backup & Recovery */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Database size={16} color="var(--primary)" />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                Local Storage & Backup
              </h4>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
              Export snapshots of your subjects, students, and attendance sessions for offline archival or transfer between devices.
            </p>

            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleExportBackup}>
                <Download size={14} />
                Export JSON Backup
              </button>

              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <Upload size={14} />
                Import JSON Backup
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  style={{ display: 'none' }}
                />
              </label>

              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--status-absent)', marginLeft: 'auto' }}
                onClick={handleResetData}
              >
                <Trash2 size={14} />
                Reset Demo Data
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
