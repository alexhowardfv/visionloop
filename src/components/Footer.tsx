'use client';

import React from 'react';
import { FooterProps } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export const Footer: React.FC<FooterProps> = ({ lastUpdateTime, model, version, isConnected }) => {
  const { isAuthenticated, isHydrated } = useAuth();
  const getTimeSinceUpdate = () => {
    if (lastUpdateTime === 0) return 'N/A';
    const diff = Date.now() - lastUpdateTime;
    if (diff < 1000) return `${diff}ms ago`;
    return `${Math.floor(diff / 1000)}s ago`;
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-12 bg-primary/80 backdrop-blur-glass border-t border-border z-40">
      <div className="h-full px-6 portrait:px-3 flex items-center justify-between text-text-secondary text-sm portrait:text-xs">
        <div className="flex items-center gap-6 portrait:gap-3">
          <div className="flex items-center gap-2 portrait:gap-1">
            <span className="text-text-muted portrait:hidden">Model:</span>
            <span className="text-white font-medium">{model}</span>
          </div>


          <div className="flex items-center gap-2 portrait:gap-1">
            <span className="text-text-muted portrait:hidden">Version:</span>
            <span className="text-white font-medium">{version}</span>
          </div>


          <div className="flex items-center gap-2 portrait:gap-1">
            <span className="text-text-muted portrait:hidden">Last Update:</span>
            <span className="text-white font-medium">{getTimeSinceUpdate()}</span>
          </div>

        </div>

        <div className="flex items-center gap-6 portrait:gap-3">

          {isHydrated && (isAuthenticated ? (
            <div className="flex items-center gap-2 bg-green-600/20 px-3 py-1 rounded-full">
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
              <span className="text-green-400 font-medium text-xs">Authenticated</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-text-muted font-medium">Not Authenticated</span>
            </div>
          ))}


          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-text-secondary font-medium">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
