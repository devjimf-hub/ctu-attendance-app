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
  HelpCircle
} from 'lucide-react';
import { FirebaseConfig, SyncStatus } from '../types';
import {
  getSavedFirebaseConfig,
  saveFirebaseConfig,
  removeFirebaseConfig,
  resetFirebaseInstance
} from '../firebase/config';
import { storageService } from '../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus;
  onSyncRefresh: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  onSyncRefresh
}) => {
  const currentConfig = getSavedFirebaseConfig() || {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  };

  const [apiKey, setApiKey] = useState(currentConfig.apiKey || '');
  const [authDomain, setAuthDomain] = useState(currentConfig.authDomain || '');
  const [projectId, setProjectId] = useState(currentConfig.projectId || '');
  const [storageBucket, setStorageBucket] = useState(currentConfig.storageBucket || '');
  const [messagingSenderId, setMessagingSenderId] = useState(currentConfig.messagingSenderId || '');
  const [appId, setAppId] = useState(currentConfig.appId || '');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showDeployHelp, setShowDeployHelp] = useState(false);

  if (!isOpen) return null;

  const handleSaveFirebase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !projectId.trim()) {
      alert('Please provide at least the Firebase API Key and Project ID.');
      return;
    }

    const config: FirebaseConfig = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim(),
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim(),
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim()
    };

    saveFirebaseConfig(config);
    resetFirebaseInstance();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    onSyncRefresh();
    storageService.syncWithFirebase();
  };

  const handleDisconnectFirebase = () => {
    if (confirm('Disconnect Firebase cloud sync? Your data will remain stored in local offline storage.')) {
      removeFirebaseConfig();
      resetFirebaseInstance();
      setApiKey('');
      setAuthDomain('');
      setProjectId('');
      setStorageBucket('');
      setMessagingSenderId('');
      setAppId('');
      onSyncRefresh();
    }
  };

  const handleExportBackup = () => {
    const jsonStr = storageService.exportFullBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `UniAttend_Backup_${new Date().toISOString().slice(0, 10)}.json`;
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="modal-icon-badge">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="modal-title">System & Cloud Sync Settings</h3>
              <p className="modal-subtitle">Configure Firebase sync & offline backups</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Cloud Sync Status */}
          <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cloud size={16} color="var(--primary)" />
                <span>Firebase Cloud Sync:</span>
                <span style={{ color: syncStatus.firebaseConnected ? 'var(--status-present)' : 'var(--text-muted)' }}>
                  {syncStatus.firebaseConnected ? 'Connected' : 'Not Connected (Local Mode)'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {syncStatus.isOnline ? '🟢 Device is Online' : '🟠 Device is Offline (IndexedDB local cache)'}
              </div>
            </div>

            <button className="btn btn-sm btn-secondary" onClick={() => storageService.syncWithFirebase()}>
              <RefreshCw size={13} />
              Sync Now
            </button>
          </div>

          {/* Firebase Configuration Form */}
          <form onSubmit={handleSaveFirebase} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Firebase Project Credentials</h4>
              <button
                type="button"
                className="btn-ghost btn-sm"
                style={{ fontSize: '0.75rem', color: 'var(--primary)' }}
                onClick={() => setShowDeployHelp(!showDeployHelp)}
              >
                <HelpCircle size={14} /> How to get config
              </button>
            </div>

            {showDeployHelp && (
              <div style={{ padding: '0.85rem', borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                <strong>How to connect your Firebase Project:</strong>
                <ol style={{ paddingLeft: '1.2rem', marginTop: '0.35rem' }}>
                  <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>Firebase Console</a> & create a project.</li>
                  <li>Enable <strong>Cloud Firestore</strong> database.</li>
                  <li>Go to <strong>Project Settings</strong> &rarr; <strong>Web App</strong> and copy the config object keys below.</li>
                </ol>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">API Key</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Project ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="my-college-attendance"
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Auth Domain (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="project.firebaseapp.com"
                  value={authDomain}
                  onChange={e => setAuthDomain(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">App ID (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="1:12345:web:67890"
                  value={appId}
                  onChange={e => setAppId(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button type="submit" className="btn btn-primary btn-sm">
                Save & Connect Cloud
              </button>
              {syncStatus.firebaseConnected && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDisconnectFirebase}
                >
                  Disconnect
                </button>
              )}
              {savedSuccess && (
                <span style={{ fontSize: '0.8rem', color: 'var(--status-present)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle2 size={14} /> Saved!
                </span>
              )}
            </div>
          </form>

          <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

          {/* Backup & Recovery */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Local Data & Backup
            </h4>
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
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
