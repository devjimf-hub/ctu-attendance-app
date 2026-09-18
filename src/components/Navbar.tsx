import React, { useState } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Sun,
  Moon,
  Settings,
  LogOut,
  Download
} from 'lucide-react';
import { SyncStatus, TeacherUser } from '../types';

interface NavbarProps {
  syncStatus: SyncStatus;
  theme: 'dark' | 'light';
  teacher: TeacherUser | null;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onManualSync: () => void;
  onLogout: () => void;
  canInstallPwa?: boolean;
  onInstallPwa?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  syncStatus,
  theme,
  teacher,
  onToggleTheme,
  onOpenSettings,
  onManualSync,
  onLogout,
  canInstallPwa,
  onInstallPwa
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="google-header no-print">
      <div className="header-left">
        <div className="header-title-group">
          <div className="app-logo-icon" style={{ background: 'transparent', padding: 0, overflow: 'hidden' }}>
            <img src="/logo.webp" alt="CTU Class Check Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          </div>
          <span className="header-app-name">
            Class Check
          </span>
        </div>
      </div>

      <div className="header-right">
        {/* PWA Install Button */}
        {canInstallPwa && onInstallPwa && (
          <button
            className="btn btn-sm btn-primary"
            onClick={onInstallPwa}
            title="Install Mobile App"
          >
            <Download size={14} />
            <span className="hide-on-mobile">Install App</span>
          </button>
        )}

        {/* Sync Status Chip */}
        <button
          className={`sync-chip ${syncStatus.isOnline ? 'online' : 'offline'}`}
          onClick={onManualSync}
          style={{ cursor: 'pointer' }}
          title={syncStatus.isOnline ? 'Online - synced with Cloud' : 'Offline - local storage'}
        >
          {syncStatus.isSyncing ? (
            <RefreshCw size={12} className="spin-animate" />
          ) : syncStatus.isOnline ? (
            <Wifi size={12} />
          ) : (
            <WifiOff size={12} />
          )}
          <span>
            {syncStatus.isSyncing
              ? 'Syncing'
              : syncStatus.isOnline
              ? syncStatus.pendingChangesCount > 0
                ? `${syncStatus.pendingChangesCount} pending`
                : 'Online'
              : 'Offline'}
          </span>
        </button>

        {/* Theme Toggle */}
        <button className="btn-icon" onClick={onToggleTheme} title="Toggle Theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Settings */}
        <button className="btn-icon" onClick={onOpenSettings} title="Settings">
          <Settings size={18} />
        </button>

        {/* Teacher Avatar & Logout Menu */}
        {teacher && (
          <div style={{ position: 'relative' }}>
            <div
              className="teacher-avatar"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              title={teacher.name}
            >
              {teacher.name.charAt(0)}
            </div>

            {showProfileMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '42px',
                  right: 0,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-md)',
                  minWidth: '200px',
                  padding: '0.85rem',
                  zIndex: 60
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{teacher.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  {teacher.email || teacher.department}
                </div>

                <button
                  className="btn btn-sm btn-secondary"
                  style={{ width: '100%', color: 'var(--google-red)' }}
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLogout();
                  }}
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
