'use client';

import React from 'react';
import Image from 'next/image';
import { HeaderProps } from '@/types';
import { Tooltip } from './Tooltip';
import { useAuth } from '@/contexts/AuthContext';

interface ExtendedHeaderProps extends HeaderProps {
  onOpenSettings?: () => void;
  onOpenDataInspector?: () => void;
  onOpenAnalytics?: () => void;
  onOpenCollections?: () => void;
  capturedDataCount?: number;
  collectionCount?: number;
  onOpenLogin?: () => void;
  onLogout?: () => void;
  notification?: {
    message: string;
    type: 'success' | 'error' | 'info';
    isVisible: boolean;
  };
}

export const Header: React.FC<ExtendedHeaderProps> = ({
  isPaused,
  onTogglePause,
  onOpenSettings,
  onOpenDataInspector,
  onOpenAnalytics,
  onOpenCollections,
  capturedDataCount = 0,
  collectionCount = 0,
  onOpenLogin,
  onLogout,
  notification,
}) => {
  const { isAuthenticated, isHydrated } = useAuth();

  return (
    <header className={`fixed top-0 left-0 right-0 h-16 backdrop-blur-glass border-b z-50 transition-colors ${
      isPaused ? 'bg-yellow-900/30 border-yellow-600/40' : 'bg-primary/80 border-border'
    }`}>
      <div className="h-full px-6 portrait:px-3 grid grid-cols-[1fr_auto_1fr] items-center">
        {/* Left: Logo */}
        <div className="flex items-center gap-3 portrait:gap-2">
          <Image src="/logo.png" alt="Logo" width={64} height={64} className="rounded portrait:w-10 portrait:h-10" />
          <div>
            <h1 className="text-white font-semibold text-lg portrait:text-sm">Flexible Vision Loop</h1>
            <p className="text-text-muted text-xs portrait:hidden">Real-time Inspection Feedback</p>
          </div>
        </div>

        {/* Center: Pause/Resume */}
        <div className="flex items-center gap-3 portrait:gap-2">
          <button
            onClick={onTogglePause}
            className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              isPaused
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600/80 hover:bg-red-700 text-white'
            }`}
          >
            {isPaused ? (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Resume Queue
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
                Pause Queue
              </>
            )}
          </button>
          {isPaused && (
            <span className="flex items-center gap-1.5 text-yellow-400 text-sm font-medium animate-[pulse_3s_ease-in-out_infinite]">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
              PAUSED
            </span>
          )}
        </div>

        {/* Right: Notification + Action buttons + Auth */}
        <div className="flex items-center gap-3 portrait:gap-2 justify-end">
          {/* Inline Notification */}
          {notification?.isVisible && (
            <div
              className={`flex-1 flex items-center justify-center transition-opacity duration-300 ${
                notification.isVisible ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  notification.type === 'success'
                    ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                    : notification.type === 'error'
                    ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                    : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                }`}
              >
                {notification.type === 'success' && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {notification.type === 'error' && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {notification.type === 'info' && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {notification.message}
              </span>
            </div>
          )}

          {/* Collections Button */}
          {onOpenCollections && (
            <Tooltip content="Collection Manager" position="bottom">
              <button
                onClick={onOpenCollections}
                className="relative p-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 hover:text-cyan-300 transition-all"
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
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {collectionCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-cyan-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {collectionCount > 99 ? '99+' : collectionCount}
                  </span>
                )}
              </button>
            </Tooltip>
          )}

          {/* Analytics Button */}
          {onOpenAnalytics && (
            <Tooltip content="Data Analytics" position="bottom">
              <button
                onClick={onOpenAnalytics}
                className="relative p-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 hover:text-purple-300 transition-all"
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
            </Tooltip>
          )}

          {/* Data Inspector Button */}
          {onOpenDataInspector && (
            <Tooltip content="Data Inspector" position="bottom">
              <button
                onClick={onOpenDataInspector}
                className="relative p-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 hover:text-green-300 transition-all"
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
            </Tooltip>
          )}

          {/* Settings Button */}
          {onOpenSettings && (
            <Tooltip content="Settings" position="bottom">
              <button
                onClick={onOpenSettings}
                className="p-2 rounded-lg bg-primary-lighter hover:bg-primary-lighter/70 text-text-secondary hover:text-white transition-all"
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
            </Tooltip>
          )}

          {/* Login/Logout Button */}
          {isHydrated && (isAuthenticated ? (
            onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all bg-red-600/20 text-red-400 hover:bg-red-600/30"
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
                  <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </svg>
                <span>Logout</span>
              </button>
            )
          ) : (
            onOpenLogin && (
              <Tooltip content="Login to Cloud" position="bottom">
                <button
                  onClick={onOpenLogin}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all bg-blue-600 hover:bg-blue-700 text-white"
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
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                  </svg>
                  <span>Login</span>
                </button>
              </Tooltip>
            )
          ))}
        </div>
      </div>
    </header>
  );
};
