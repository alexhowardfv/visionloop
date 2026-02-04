'use client';

import React from 'react';
import { FooterProps } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export const Footer: React.FC<FooterProps> = ({ lastUpdateTime, queueLength, fps, socketHost, socketPort, model, version }) => {
  const { userId } = useAuth();
  const getTimeSinceUpdate = () => {
    if (lastUpdateTime === 0) return 'N/A';
    const diff = Date.now() - lastUpdateTime;
    if (diff < 1000) return `${diff}ms ago`;
    return `${Math.floor(diff / 1000)}s ago`;
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-12 bg-primary/80 backdrop-blur-glass border-t border-border z-40">
      <div className="h-full px-6 flex items-center justify-between text-text-secondary text-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Model:</span>
            <span className="text-white font-medium">{model}</span>
          </div>

          <div className="h-4 w-px bg-border"></div>

          <div className="flex items-center gap-2">
            <span className="text-text-muted">Version:</span>
            <span className="text-white font-medium">{version}</span>
          </div>

          <div className="h-4 w-px bg-border"></div>

          <div className="flex items-center gap-2">
            <span className="text-text-muted">Last Update:</span>
            <span className="text-white font-medium">{getTimeSinceUpdate()}</span>
          </div>

          <div className="h-4 w-px bg-border"></div>

          <div className="flex items-center gap-2">
            <span className="text-text-muted">Queue:</span>
            <span className="text-white font-medium">{queueLength} batches</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Socket:</span>
            <span className="text-white font-medium">{socketHost}:{socketPort}</span>
          </div>

          <div className="h-4 w-px bg-border"></div>

          <div className="flex items-center gap-2">
            <span className="text-text-muted">User ID:</span>
            <span className="text-yellow-400 font-medium">{userId || 'Not logged in'}</span>
          </div>

          <div className="h-4 w-px bg-border"></div>

          <div className="flex items-center gap-2">
            <span className="text-text-muted">FPS:</span>
            <span className="text-white font-medium">{fps.toFixed(1)}</span>
          </div>

          <div className="h-4 w-px bg-border"></div>

          <div className="flex items-center gap-2">
            <span className="text-green-500 font-medium">System Active</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
