import React from 'react';
import { SyncStatus } from '../types';

interface OfflineBannerProps {
  syncStatus: SyncStatus;
  onRetrySync: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = () => {
  return null;
};
