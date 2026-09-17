import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { SyncStatus } from '../types';

interface OfflineBannerProps {
  syncStatus: SyncStatus;
  onRetrySync: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ syncStatus, onRetrySync }) => {
  if (syncStatus.isOnline) return null;

  return (
    <div className="offline-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <WifiOff size={16} />
        <span>
          <strong>Offline Mode Active:</strong> You can take attendance, add students, and manage courses without internet. Everything saves locally and will auto-sync when reconnected.
          {syncStatus.pendingChangesCount > 0 && ` (${syncStatus.pendingChangesCount} changes queued)`}
        </span>
      </div>
      <button
        className="btn btn-sm"
        style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#fff', border: 'none' }}
        onClick={onRetrySync}
      >
        <RefreshCw size={12} />
        Check Connection
      </button>
    </div>
  );
};
