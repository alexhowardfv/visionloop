'use client';

import React, { useState, useEffect } from 'react';

type SettingsTab = 'connection' | 'display' | 'data';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHost: string;
  currentPort: string;
  onSave: (host: string, port: string) => void;
  maxBatchQueue: number;
  onMaxBatchQueueChange: (value: number) => void;
  onClearAllData?: () => void;
  dataStats?: {
    capturedMessages: number;
    collectionImages: number;
    batchQueueSize: number;
  };
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentHost,
  currentPort,
  onSave,
  maxBatchQueue,
  onMaxBatchQueueChange,
  onClearAllData,
  dataStats,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('connection');
  const [host, setHost] = useState(currentHost);
  const [port, setPort] = useState(currentPort);
  const [batchQueueSize, setBatchQueueSize] = useState(maxBatchQueue);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Sync state when props change
  useEffect(() => {
    setHost(currentHost);
    setPort(currentPort);
    setBatchQueueSize(maxBatchQueue);
  }, [currentHost, currentPort, maxBatchQueue]);

  const handleSave = () => {
    onSave(host, port);
    if (batchQueueSize !== maxBatchQueue) {
      onMaxBatchQueueChange(batchQueueSize);
    }
    onClose();
  };

  const handleReset = () => {
    setHost('localhost');
    setPort('5000');
    setBatchQueueSize(5);
  };

  const handleClearAllData = () => {
    if (onClearAllData) {
      onClearAllData();
      setShowClearConfirm(false);
    }
  };

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'connection',
      label: 'Connection',
      icon: (
        <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path>
        </svg>
      ),
    },
    {
      id: 'display',
      label: 'Display',
      icon: (
        <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
        </svg>
      ),
    },
    {
      id: 'data',
      label: 'Data',
      icon: (
        <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
        </svg>
      ),
    },
  ];

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
            <h2 className="text-white text-xl font-semibold">Settings</h2>
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

        {/* Tabs */}
        <div className="flex border-b border-border bg-primary-lighter">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-text-secondary hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 min-h-[400px]">
          {/* Connection Tab */}
          {activeTab === 'connection' && (
            <div className="space-y-6">
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
          )}

          {/* Display Tab */}
          {activeTab === 'display' && (
            <div className="space-y-6">
              {/* Info Banner */}
              <div className="bg-purple-600/20 border border-purple-500/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0"
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
                    <p className="text-purple-200 text-sm font-medium">Display Settings</p>
                    <p className="text-purple-300/80 text-xs mt-1">
                      Configure how the application displays data and manages memory.
                    </p>
                  </div>
                </div>
              </div>

              {/* Batch Queue Size */}
              <div className="space-y-3">
                <label className="block text-text-secondary text-sm font-medium">
                  Batch Queue Size
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[5, 10, 20].map((size) => (
                    <button
                      key={size}
                      onClick={() => setBatchQueueSize(size)}
                      className={`px-4 py-3 border rounded-lg text-sm font-medium transition-all ${
                        batchQueueSize === size
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-primary-lighter hover:bg-primary-lighter/70 border-border text-text-secondary'
                      }`}
                    >
                      {size} batches{size === 5 && ' (Default)'}
                    </button>
                  ))}
                </div>
                <p className="text-text-muted text-xs">
                  Number of inspection batches to keep in memory for carousel navigation. Higher values use more memory but allow browsing more history.
                </p>
              </div>

              {/* Current Queue Status */}
              {dataStats && (
                <div className="bg-primary-lighter rounded-lg p-4 border border-border">
                  <p className="text-text-muted text-xs mb-2">Current Queue Status:</p>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400 font-medium">{dataStats.batchQueueSize}</span>
                    <span className="text-text-muted">/</span>
                    <span className="text-white">{batchQueueSize}</span>
                    <span className="text-text-muted text-sm">batches in queue</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Data Tab */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              {/* Info Banner */}
              <div className="bg-amber-600/20 border border-amber-500/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0"
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
                    <p className="text-amber-200 text-sm font-medium">Data Management</p>
                    <p className="text-amber-300/80 text-xs mt-1">
                      Manage captured data, collection storage, and memory usage.
                    </p>
                  </div>
                </div>
              </div>

              {/* Data Statistics */}
              {dataStats && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-primary-lighter rounded-lg p-4 border border-border">
                    <p className="text-text-muted text-xs mb-1">Captured Messages</p>
                    <p className="text-2xl font-bold text-blue-400">{dataStats.capturedMessages.toLocaleString()}</p>
                  </div>
                  <div className="bg-primary-lighter rounded-lg p-4 border border-border">
                    <p className="text-text-muted text-xs mb-1">Collection Images</p>
                    <p className="text-2xl font-bold text-green-400">{dataStats.collectionImages.toLocaleString()}</p>
                  </div>
                  <div className="bg-primary-lighter rounded-lg p-4 border border-border">
                    <p className="text-text-muted text-xs mb-1">Batch Queue</p>
                    <p className="text-2xl font-bold text-purple-400">{dataStats.batchQueueSize}</p>
                  </div>
                </div>
              )}

              {/* Clear All Data Section */}
              <div className="bg-red-600/10 border border-red-500/30 rounded-lg p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-red-500" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-red-400 font-semibold mb-1">Clear All Data</h3>
                    <p className="text-text-muted text-sm mb-4">
                      Permanently delete all captured WebSocket messages, collection images, batch queue, and selections. This action cannot be undone.
                    </p>
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      disabled={!onClearAllData || (dataStats && dataStats.capturedMessages === 0 && dataStats.collectionImages === 0)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/30 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                      Clear All Data
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
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
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Clear All Data Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-primary-darker border border-border rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-white text-lg font-semibold">Clear All Data?</h3>
                <p className="text-text-muted text-sm">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-6">
              This will permanently delete:
            </p>
            <ul className="text-text-muted text-sm mb-6 space-y-1 ml-4">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                {dataStats?.capturedMessages.toLocaleString() || 0} captured WebSocket messages
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                {dataStats?.collectionImages.toLocaleString() || 0} collection images
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                {dataStats?.batchQueueSize || 0} batches in queue
              </li>
            </ul>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-text-secondary hover:text-white hover:bg-primary-lighter rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllData}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                Yes, Clear All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
