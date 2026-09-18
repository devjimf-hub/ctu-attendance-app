import React from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface PWAInstallPromptProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ onInstall, onDismiss }) => {
  return (
    <div className="pwa-install-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
          <Smartphone size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            Install Class Check App
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Works 100% offline in lecture halls & syncs automatically
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button className="btn btn-sm btn-primary" onClick={onInstall}>
          <Download size={14} />
          Install
        </button>
        <button className="btn-icon" style={{ width: '28px', height: '28px' }} onClick={onDismiss} aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
