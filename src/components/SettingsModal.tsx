'use client';

import React, { useState, useEffect } from 'react';

type SettingsTab = 'connection' | 'display' | 'data' | 'admin';

export interface FeatureVisibility {
  annotationsEnabled: boolean;
  analyticsVisible: boolean;
  dataCollectionVisible: boolean;
  dataInspectorVisible: boolean;
}

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
  annotationsEnabled: boolean;
  onAnnotationsEnabledChange: (enabled: boolean) => void;
  featureVisibility: FeatureVisibility;
  onFeatureVisibilityChange: (visibility: FeatureVisibility) => void;
  isMockDataActive?: boolean;
  onToggleMockData?: (enabled: boolean, intervalMs: number, cameraCount: number, failRate: number) => void;
  onSendSingleMockBatch?: (cameraCount: number, failRate: number) => void;
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
  annotationsEnabled,
  onAnnotationsEnabledChange,
  featureVisibility,
  onFeatureVisibilityChange,
  isMockDataActive = false,
  onToggleMockData,
  onSendSingleMockBatch,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('connection');
  const [host, setHost] = useState(currentHost);
  const [port, setPort] = useState(currentPort);
  const [batchQueueSize, setBatchQueueSize] = useState(maxBatchQueue);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [localAnnotationsEnabled, setLocalAnnotationsEnabled] = useState(annotationsEnabled);
  const [localVisibility, setLocalVisibility] = useState<FeatureVisibility>(featureVisibility);
  const [mockInterval, setMockInterval] = useState(2000);
  const [mockCameraCount, setMockCameraCount] = useState(8);
  const [mockFailRate, setMockFailRate] = useState(30);

  // Sync state when props change
  useEffect(() => {
    setHost(currentHost);
    setPort(currentPort);
    setBatchQueueSize(maxBatchQueue);
    setLocalAnnotationsEnabled(annotationsEnabled);
    setLocalVisibility(featureVisibility);
  }, [currentHost, currentPort, maxBatchQueue, annotationsEnabled, featureVisibility]);

  const handleSave = () => {
    onSave(host, port);
    if (batchQueueSize !== maxBatchQueue) {
      onMaxBatchQueueChange(batchQueueSize);
    }
    if (localAnnotationsEnabled !== annotationsEnabled) {
      onAnnotationsEnabledChange(localAnnotationsEnabled);
    }
    onFeatureVisibilityChange(localVisibility);
    onClose();
  };

  const handleReset = () => {
    setHost('localhost');
    setPort('5000');
    setBatchQueueSize(5);
    setLocalAnnotationsEnabled(true);
    setLocalVisibility({
      annotationsEnabled: true,
      analyticsVisible: true,
      dataCollectionVisible: true,
      dataInspectorVisible: true,
    });
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
    {
      id: 'admin',
      label: 'Admin',
      icon: (
        <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl max-h-[90vh] bg-primary rounded-xl shadow-elevated overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-primary-lighter">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
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
            <h2 className="text-white text-lg font-semibold">Settings</h2>
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
        <div className="p-5 flex-1 overflow-y-auto">
          {/* Connection Tab */}
          {activeTab === 'connection' && (
            <div className="space-y-4">
              {/* Info Banner */}
              <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-4 h-4 text-blue-400 flex-shrink-0"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <p className="text-blue-300/80 text-xs">
                    Configure the WebSocket server connection. Changes take effect after saving.
                  </p>
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
                  className="w-full px-3 py-2.5 bg-primary-lighter border border-border rounded-lg text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                  className="w-full px-3 py-2.5 bg-primary-lighter border border-border rounded-lg text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
            <div className="space-y-4">
              {/* Info Banner */}
              <div className="bg-purple-600/20 border border-purple-500/50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-4 h-4 text-purple-400 flex-shrink-0"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <p className="text-purple-300/80 text-xs">
                    Configure how the application displays data and manages memory.
                  </p>
                </div>
              </div>

              {/* Batch Queue Size */}
              <div className="space-y-3">
                <label className="block text-text-secondary text-sm font-medium">
                  Batch Queue Size
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[5, 10, 20].map((size) => (
                    <button
                      key={size}
                      onClick={() => setBatchQueueSize(size)}
                      className={`px-3 py-2.5 border rounded-lg text-sm font-medium transition-all ${
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
            <div className="space-y-4">
              {/* Info Banner */}
              <div className="bg-amber-600/20 border border-amber-500/50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-4 h-4 text-amber-400 flex-shrink-0"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <p className="text-amber-300/80 text-xs">
                    Manage captured data, collection storage, and memory usage.
                  </p>
                </div>
              </div>

              {/* Data Statistics */}
              {dataStats && (
                <div className="bg-primary-lighter rounded-lg border border-border divide-y divide-border">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      <span className="text-text-secondary text-sm">Captured Messages</span>
                    </div>
                    <span className="text-white text-sm font-medium">{dataStats.capturedMessages.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                      <span className="text-text-secondary text-sm">Collection Images</span>
                    </div>
                    <span className="text-white text-sm font-medium">{dataStats.collectionImages.toLocaleString()}</span>
                  </div>
                  <div className="px-4 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                        <span className="text-text-secondary text-sm">Batch Queue</span>
                      </div>
                      <span className="text-white text-sm font-medium">{dataStats.batchQueueSize} / {batchQueueSize}</span>
                    </div>
                    <div className="w-full h-1.5 bg-primary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          dataStats.batchQueueSize / batchQueueSize > 0.8 ? 'bg-amber-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${Math.min((dataStats.batchQueueSize / batchQueueSize) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Clear All Data Section */}
              <div className="bg-red-600/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-500" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-red-400 font-semibold text-sm mb-1">Clear All Data</h3>
                    <p className="text-text-muted text-xs mb-3">
                      Permanently delete all captured data, collections, and batch queue. This cannot be undone.
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

          {/* Admin Tab */}
          {activeTab === 'admin' && (
            <div className="space-y-4">
              {/* Info Banner */}
              <div className="bg-indigo-600/20 border border-indigo-500/50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-4 h-4 text-indigo-400 flex-shrink-0"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                  </svg>
                  <p className="text-indigo-300/80 text-xs">
                    Control feature visibility and manage mock data generation.
                  </p>
                </div>
              </div>

              {/* Feature Visibility Section */}
              <div className="space-y-2">
                <h3 className="text-white text-sm font-semibold">Feature Visibility</h3>

                <div className="grid grid-cols-2 gap-2">
                  {/* Annotations Toggle */}
                  <div className="bg-primary-lighter/50 rounded-lg p-3 border border-border">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-text-secondary text-sm font-medium">Annotations</span>
                      <div className="relative ml-3">
                        <input
                          type="checkbox"
                          checked={localAnnotationsEnabled}
                          onChange={(e) => setLocalAnnotationsEnabled(e.target.checked)}
                          className="sr-only"
                        />
                        <div
                          className={`w-10 h-5 rounded-full transition-colors ${
                            localAnnotationsEnabled ? 'bg-blue-600' : 'bg-gray-600'
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                              localAnnotationsEnabled ? 'transform translate-x-5' : ''
                            }`}
                          ></div>
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Analytics Toggle */}
                  <div className="bg-primary-lighter/50 rounded-lg p-3 border border-border">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-text-secondary text-sm font-medium">Analytics</span>
                      <div className="relative ml-3">
                        <input
                          type="checkbox"
                          checked={localVisibility.analyticsVisible}
                          onChange={(e) => setLocalVisibility(v => ({ ...v, analyticsVisible: e.target.checked }))}
                          className="sr-only"
                        />
                        <div
                          className={`w-10 h-5 rounded-full transition-colors ${
                            localVisibility.analyticsVisible ? 'bg-purple-600' : 'bg-gray-600'
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                              localVisibility.analyticsVisible ? 'transform translate-x-5' : ''
                            }`}
                          ></div>
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Data Collection Toggle */}
                  <div className="bg-primary-lighter/50 rounded-lg p-3 border border-border">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-text-secondary text-sm font-medium">Data Collection</span>
                      <div className="relative ml-3">
                        <input
                          type="checkbox"
                          checked={localVisibility.dataCollectionVisible}
                          onChange={(e) => setLocalVisibility(v => ({ ...v, dataCollectionVisible: e.target.checked }))}
                          className="sr-only"
                        />
                        <div
                          className={`w-10 h-5 rounded-full transition-colors ${
                            localVisibility.dataCollectionVisible ? 'bg-cyan-600' : 'bg-gray-600'
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                              localVisibility.dataCollectionVisible ? 'transform translate-x-5' : ''
                            }`}
                          ></div>
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Data Inspector Toggle */}
                  <div className="bg-primary-lighter/50 rounded-lg p-3 border border-border">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-text-secondary text-sm font-medium">Data Inspector</span>
                      <div className="relative ml-3">
                        <input
                          type="checkbox"
                          checked={localVisibility.dataInspectorVisible}
                          onChange={(e) => setLocalVisibility(v => ({ ...v, dataInspectorVisible: e.target.checked }))}
                          className="sr-only"
                        />
                        <div
                          className={`w-10 h-5 rounded-full transition-colors ${
                            localVisibility.dataInspectorVisible ? 'bg-green-600' : 'bg-gray-600'
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                              localVisibility.dataInspectorVisible ? 'transform translate-x-5' : ''
                            }`}
                          ></div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border"></div>

              {/* Mock Data Generator Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-white text-sm font-semibold">Mock Data Generator</h3>
                  {isMockDataActive && (
                    <div className="flex items-center gap-2 px-2 py-1 bg-green-600/10 border border-green-600/30 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-green-400 text-xs font-medium">Active</span>
                    </div>
                  )}
                </div>

                {/* Sliders in a compact grid */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Interval */}
                  <div className="space-y-1">
                    <label className="block text-text-secondary text-xs font-medium">
                      Interval: {(mockInterval / 1000).toFixed(1)}s
                    </label>
                    <input
                      type="range"
                      min="500"
                      max="5000"
                      step="250"
                      value={mockInterval}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setMockInterval(val);
                        if (isMockDataActive) onToggleMockData?.(true, val, mockCameraCount, mockFailRate / 100);
                      }}
                      className="w-full h-2 bg-primary-lighter rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                    <div className="flex justify-between text-text-muted text-[10px]">
                      <span>0.5s</span>
                      <span>5.0s</span>
                    </div>
                  </div>

                  {/* Camera Count */}
                  <div className="space-y-1">
                    <label className="block text-text-secondary text-xs font-medium">
                      Cameras: {mockCameraCount}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="34"
                      step="1"
                      value={mockCameraCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setMockCameraCount(val);
                        if (isMockDataActive) onToggleMockData?.(true, mockInterval, val, mockFailRate / 100);
                      }}
                      className="w-full h-2 bg-primary-lighter rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                    <div className="flex justify-between text-text-muted text-[10px]">
                      <span>1</span>
                      <span>34</span>
                    </div>
                  </div>

                  {/* Fail Rate */}
                  <div className="space-y-1">
                    <label className="block text-text-secondary text-xs font-medium">
                      Fail Rate: {mockFailRate}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={mockFailRate}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setMockFailRate(val);
                        if (isMockDataActive) onToggleMockData?.(true, mockInterval, mockCameraCount, val / 100);
                      }}
                      className="w-full h-2 bg-primary-lighter rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                    <div className="flex justify-between text-text-muted text-[10px]">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newEnabled = !isMockDataActive;
                      onToggleMockData?.(newEnabled, mockInterval, mockCameraCount, mockFailRate / 100);
                      if (newEnabled) onClose();
                    }}
                    className={`flex-1 px-3 py-2.5 rounded-lg text-white text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      isMockDataActive
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {isMockDataActive ? (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="4" width="4" height="16" rx="1" />
                          <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                        Stop
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Start Interval
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onSendSingleMockBatch?.(mockCameraCount, mockFailRate / 100);
                      onClose();
                    }}
                    className="flex-1 px-3 py-2.5 bg-transparent hover:bg-green-600/20 border border-green-600 rounded-lg text-green-400 text-sm font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Send Single
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-border px-5 py-3 bg-primary-lighter flex items-center justify-between">
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
