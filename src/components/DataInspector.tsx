'use client';

import React, { useState, useEffect } from 'react';

interface DataInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  capturedData: any[];
  onClearData: () => void;
}

export const DataInspector: React.FC<DataInspectorProps> = ({
  isOpen,
  onClose,
  capturedData,
  onClearData,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedData = selectedIndex !== null ? capturedData[selectedIndex] : null;

  const handleDownloadAll = () => {
    const dataStr = JSON.stringify(capturedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `websocket-data-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSelected = () => {
    if (!selectedData) return;
    const dataStr = JSON.stringify(selectedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `websocket-message-${selectedIndex}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = () => {
    if (!selectedData) return;
    const dataStr = JSON.stringify(selectedData, null, 2);
    navigator.clipboard.writeText(dataStr);
    alert('Copied to clipboard!');
  };

  const filteredData = capturedData.filter((data, index) => {
    if (!searchQuery) return true;
    const dataStr = JSON.stringify(data).toLowerCase();
    return dataStr.includes(searchQuery.toLowerCase()) || index.toString().includes(searchQuery);
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-7xl h-[90vh] bg-primary rounded-xl shadow-elevated overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-primary-lighter">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <div>
              <h2 className="text-white text-xl font-semibold">WebSocket Data Inspector</h2>
              <p className="text-text-muted text-sm">
                {capturedData.length} message{capturedData.length !== 1 ? 's' : ''} captured
              </p>
            </div>
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
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Message List */}
          <div className="w-80 border-r border-border flex flex-col bg-primary-lighter">
            {/* Search & Actions */}
            <div className="p-4 space-y-3 border-b border-border">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full px-3 py-2 bg-primary border border-border rounded-lg text-white placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadAll}
                  disabled={capturedData.length === 0}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-all"
                >
                  Download All
                </button>
                <button
                  onClick={onClearData}
                  disabled={capturedData.length === 0}
                  className="flex-1 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 disabled:bg-gray-700 disabled:cursor-not-allowed text-red-400 text-sm rounded-lg transition-all"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto">
              {filteredData.length === 0 ? (
                <div className="p-4 text-center text-text-muted text-sm">
                  {capturedData.length === 0 ? 'No messages captured yet' : 'No matches found'}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredData.map((data, index) => {
                    const originalIndex = capturedData.indexOf(data);
                    const timestamp = data._timestamp || Date.now();
                    const isSelected = selectedIndex === originalIndex;
                    return (
                      <button
                        key={originalIndex}
                        onClick={() => setSelectedIndex(originalIndex)}
                        className={`w-full text-left px-4 py-3 hover:bg-primary transition-all ${
                          isSelected ? 'bg-blue-600/20 border-l-4 border-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-text-secondary text-xs font-medium">
                            Message #{originalIndex + 1}
                          </span>
                          <span className="text-text-muted text-xs">
                            {new Date(timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-white text-sm font-mono truncate">
                          {data.model || data.overall_pass_fail || 'Unknown'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Content - Data Viewer */}
          <div className="flex-1 flex flex-col bg-primary">
            {selectedData ? (
              <>
                {/* Actions Bar */}
                <div className="px-6 py-3 border-b border-border bg-primary-lighter flex items-center justify-between">
                  <span className="text-text-secondary text-sm font-medium">
                    Message #{(selectedIndex || 0) + 1} Details
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyToClipboard}
                      className="px-3 py-1.5 bg-primary-lighter hover:bg-primary border border-border rounded text-text-secondary hover:text-white text-sm transition-all"
                    >
                      Copy JSON
                    </button>
                    <button
                      onClick={handleDownloadSelected}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition-all"
                    >
                      Download
                    </button>
                  </div>
                </div>

                {/* JSON Viewer */}
                <div className="flex-1 overflow-auto p-6">
                  <pre className="text-sm font-mono text-green-400 bg-black/30 rounded-lg p-4 overflow-auto">
                    {JSON.stringify(selectedData, null, 2)}
                  </pre>

                  {/* Data Structure Info */}
                  <div className="mt-6 space-y-4">
                    <h3 className="text-white font-semibold">Quick Info</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-primary-lighter rounded-lg p-3">
                        <p className="text-text-muted text-xs mb-1">Model</p>
                        <p className="text-white text-sm">{selectedData.model || 'N/A'}</p>
                      </div>
                      <div className="bg-primary-lighter rounded-lg p-3">
                        <p className="text-text-muted text-xs mb-1">Overall Status</p>
                        <p className="text-white text-sm">
                          {selectedData.overall_pass_fail || 'N/A'}
                        </p>
                      </div>
                      <div className="bg-primary-lighter rounded-lg p-3">
                        <p className="text-text-muted text-xs mb-1">Total Inputs</p>
                        <p className="text-white text-sm">{selectedData.total_inputs || 'N/A'}</p>
                      </div>
                      <div className="bg-primary-lighter rounded-lg p-3">
                        <p className="text-text-muted text-xs mb-1">Processing Time</p>
                        <p className="text-white text-sm">
                          {selectedData.total_time ? `${selectedData.total_time}ms` : 'N/A'}
                        </p>
                      </div>
                      <div className="bg-primary-lighter rounded-lg p-3 col-span-2">
                        <p className="text-text-muted text-xs mb-1">Results Count</p>
                        <p className="text-white text-sm">
                          {selectedData.results
                            ? Object.keys(selectedData.results).length + ' cameras'
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <svg
                    className="w-16 h-16 text-text-muted mx-auto mb-4"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path>
                  </svg>
                  <p className="text-text-secondary">Select a message to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
