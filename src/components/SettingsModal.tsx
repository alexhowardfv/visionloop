'use client';

import React, { useState } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHost: string;
  currentPort: string;
  onSave: (host: string, port: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentHost,
  currentPort,
  onSave,
}) => {
  const [host, setHost] = useState(currentHost);
  const [port, setPort] = useState(currentPort);

  const handleSave = () => {
    onSave(host, port);
    onClose();
  };

  const handleReset = () => {
    setHost('localhost');
    setPort('5000');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-primary rounded-xl shadow-elevated overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-primary-lighter">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
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
            </div>
            <h2 className="text-white text-xl font-semibold">Connection Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Info Banner */}
          <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div>
                <p className="text-blue-200 text-sm font-medium">Socket.io Configuration</p>
                <p className="text-blue-300/80 text-xs mt-1">
                  Configure the WebSocket server connection. Changes take effect immediately after
                  saving. The page will reload to apply new settings.
                </p>
              </div>
            </div>
          </div>

          {/* Socket Host */}
          <div className="space-y-2">
            <label htmlFor="socket-host" className="block text-text-secondary text-sm font-medium">
              Socket.io Server Host
            </label>
            <input
              id="socket-host"
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="e.g., localhost or 192.168.100.95"
              className="w-full px-4 py-3 bg-primary-lighter border border-border rounded-lg text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-text-muted text-xs">
              Enter the IP address or hostname of your Socket.io server
            </p>
          </div>

          {/* Socket Port */}
          <div className="space-y-2">
            <label htmlFor="socket-port" className="block text-text-secondary text-sm font-medium">
              Socket.io Server Port
            </label>
            <input
              id="socket-port"
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="e.g., 5000"
              className="w-full px-4 py-3 bg-primary-lighter border border-border rounded-lg text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-text-muted text-xs">Default port is 5000</p>
          </div>

          {/* Connection Preview */}
          <div className="bg-primary-lighter rounded-lg p-4 border border-border">
            <p className="text-text-muted text-xs mb-2">Connection URL Preview:</p>
            <code className="text-blue-400 text-sm font-mono">
              http://{host || 'localhost'}:{port || '5000'}
            </code>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <p className="text-text-secondary text-sm font-medium">Quick Presets:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setHost('localhost');
                  setPort('5000');
                }}
                className="px-4 py-2 bg-primary-lighter hover:bg-primary-lighter/70 border border-border rounded-lg text-text-secondary text-sm transition-all"
              >
                Localhost
              </button>
              <button
                onClick={() => {
                  setHost('192.168.100.95');
                  setPort('5000');
                }}
                className="px-4 py-2 bg-primary-lighter hover:bg-primary-lighter/70 border border-border rounded-lg text-text-secondary text-sm transition-all"
              >
                192.168.100.95
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-border px-6 py-4 bg-primary-lighter flex items-center justify-between">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-primary-lighter hover:bg-primary-lighter/70 border border-border rounded-lg text-text-secondary transition-all"
          >
            Reset to Default
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-primary-lighter hover:bg-primary-lighter/70 border border-border rounded-lg text-text-secondary transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-all"
            >
              Save & Reconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
