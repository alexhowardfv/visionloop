'use client';

import React from 'react';
import { HeaderProps } from '@/types';

interface ExtendedHeaderProps extends HeaderProps {
  onOpenSettings?: () => void;
  onOpenDataInspector?: () => void;
  onOpenAnalytics?: () => void;
  capturedDataCount?: number;
  onOpenLogin?: () => void;
  isAuthenticated?: boolean;
}

export const Header: React.FC<ExtendedHeaderProps> = ({
  isConnected,
  isPaused,
  onTogglePause,
  overallStatus,
  onOpenSettings,
  onOpenDataInspector,
  onOpenAnalytics,
  capturedDataCount = 0,
  onOpenLogin,
  isAuthenticated = false,
}) => {
  const getStatusColor = () => {
    switch (overallStatus) {
      case 'PASS':
        return 'bg-status-pass';
      case 'FAIL':
        return 'bg-status-fail';
      default:
        return 'bg-status-unknown';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-primary/80 backdrop-blur-glass border-b border-border z-50">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-white font-semibold text-lg">Flexible Vision Loop</h1>
            <p className="text-text-muted text-xs">Real-time Inspection</p>
          </div>
        </div>

        {/* Center Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
            <span className="text-white text-sm font-medium">{overallStatus}</span>
          </div>

          <div className="h-6 w-px bg-border"></div>

          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
            ></div>
            <span className="text-text-secondary text-sm">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {/* Login/Auth Status */}
          {onOpenLogin && (
            <button
              onClick={onOpenLogin}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                isAuthenticated
                  ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              title={isAuthenticated ? 'Authenticated' : 'Login'}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isAuthenticated ? (
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                ) : (
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                )}
              </svg>
              <span>{isAuthenticated ? 'Authenticated' : 'Login'}</span>
            </button>
          )}

          {/* Analytics Button - always show so user can import data */}
          {onOpenAnalytics && (
            <button
              onClick={onOpenAnalytics}
              className="relative p-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 hover:text-purple-300 transition-all"
              title="Data Analytics"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              {capturedDataCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {capturedDataCount > 99 ? '99+' : capturedDataCount}
                </span>
              )}
            </button>
          )}

          {/* Data Inspector Button */}
          {onOpenDataInspector && (
            <button
              onClick={onOpenDataInspector}
              className="relative p-2 rounded-lg bg-primary-lighter hover:bg-primary-lighter/70 text-text-secondary hover:text-white transition-all"
              title="Data Inspector"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              {capturedDataCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {capturedDataCount > 99 ? '99+' : capturedDataCount}
                </span>
              )}
            </button>
          )}

          {/* Settings Button */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg bg-primary-lighter hover:bg-primary-lighter/70 text-text-secondary hover:text-white transition-all"
              title="Connection Settings"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </button>
          )}

          {/* Pause/Resume Button */}
          <button
            onClick={onTogglePause}
            className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              isPaused
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {isPaused ? (
              <>
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                RESUME
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
                PAUSE
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
