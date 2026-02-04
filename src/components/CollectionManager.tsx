'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CategoryCard } from './CategoryCard';
import { RandomSamplingCard } from './RandomSamplingCard';
import {
  getTagStatsSorted,
  getImagesForDownload,
  getTotalCount,
  ResultFilter,
  SortMode,
  setCollectionTarget,
  setUniformTarget,
  setTargetForRareTags,
  clearCollectionTargets,
  generateRandomSamplesFromExisting,
} from '@/lib/collectionStore';
import {
  saveImages,
  openFolder,
  checkFileServerHealth,
  DownloadProgress,
} from '@/lib/downloadService';

interface CollectionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  tagColors: Record<string, string>;
}

type TargetMap = Record<string, number>;

export const CollectionManager: React.FC<CollectionManagerProps> = ({
  isOpen,
  onClose,
  tagColors,
}) => {
  // Filter and sort state
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('rarest');

  // Target state (local UI state synced with store)
  const [targets, setTargets] = useState<TargetMap>({});

  // Bulk target input
  const [bulkTarget, setBulkTarget] = useState<string>('50');
  const [rareThreshold, setRareThreshold] = useState<string>('100');

  // Server state
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  // Download state
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [lastSessionPath, setLastSessionPath] = useState<string | null>(null);

  // Get tag statistics sorted by mode
  const tagStats = useMemo(() => {
    return getTagStatsSorted(resultFilter, sortMode);
  }, [resultFilter, sortMode, isOpen, targets]);

  const totalAvailable = useMemo(() => {
    return getTotalCount(resultFilter);
  }, [resultFilter, isOpen]);

  // Calculate summary of what will be downloaded
  const downloadSummary = useMemo(() => {
    let totalImages = 0;
    let categoriesWithTargets = 0;

    for (const stat of tagStats) {
      const target = targets[stat.tag];
      if (target && target > 0) {
        categoriesWithTargets++;
        totalImages += Math.min(target, stat.count);
      }
    }

    return { totalImages, categoriesWithTargets };
  }, [targets, tagStats]);

  // Check server health on mount
  useEffect(() => {
    if (isOpen) {
      checkFileServerHealth().then(setServerOnline);
    }
  }, [isOpen]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setDownloadProgress(null);
      setLastSessionPath(null);
    }
  }, [isOpen]);

  const handleTargetChange = useCallback((tag: string, target: number) => {
    setTargets((prev) => ({
      ...prev,
      [tag]: target,
    }));
    setCollectionTarget(tag, target);
  }, []);

  const handleClearTarget = useCallback((tag: string) => {
    setTargets((prev) => {
      const { [tag]: _, ...rest } = prev;
      return rest;
    });
    setCollectionTarget(tag, 0);
  }, []);

  const handleSetAllTargets = useCallback(() => {
    const target = parseInt(bulkTarget, 10);
    if (isNaN(target) || target <= 0) return;

    const newTargets: TargetMap = {};
    for (const stat of tagStats) {
      newTargets[stat.tag] = target;
    }
    setTargets(newTargets);
    setUniformTarget(target);
  }, [bulkTarget, tagStats]);

  const handleSetRareTargets = useCallback(() => {
    const target = parseInt(bulkTarget, 10);
    const threshold = parseInt(rareThreshold, 10);
    if (isNaN(target) || target <= 0 || isNaN(threshold)) return;

    const newTargets: TargetMap = { ...targets };
    for (const stat of tagStats) {
      if (stat.count < threshold) {
        newTargets[stat.tag] = target;
      }
    }
    setTargets(newTargets);
    setTargetForRareTags(target, threshold);
  }, [bulkTarget, rareThreshold, tagStats, targets]);

  const handleClearAllTargets = useCallback(() => {
    setTargets({});
    clearCollectionTargets();
  }, []);

  const handleDownloadTargets = useCallback(async () => {
    // Build selection array from targets
    const downloadSelections = tagStats
      .filter((stat) => targets[stat.tag] && targets[stat.tag] > 0)
      .map((stat) => ({
        tag: stat.tag,
        count: Math.min(targets[stat.tag], stat.count) as number,
      }));

    if (downloadSelections.length === 0) return;

    const images = getImagesForDownload(downloadSelections, resultFilter);

    if (images.length === 0) {
      setDownloadProgress({
        total: 0,
        completed: 0,
        currentFile: '',
        status: 'error',
        error: 'No images to download',
      });
      return;
    }

    const result = await saveImages(images, setDownloadProgress);

    if (result.success && result.sessionPath) {
      setLastSessionPath(result.sessionPath);
    }
  }, [tagStats, targets, resultFilter]);

  const handleDownloadRandomSamples = useCallback(async (count: number, filter: ResultFilter) => {
    // Generate random samples from existing collection
    const samples = generateRandomSamplesFromExisting(count, filter);

    if (samples.length === 0) {
      setDownloadProgress({
        total: 0,
        completed: 0,
        currentFile: '',
        status: 'error',
        error: 'No images available to sample from',
      });
      return;
    }

    const result = await saveImages(samples, setDownloadProgress);

    if (result.success && result.sessionPath) {
      setLastSessionPath(result.sessionPath);
    }
  }, []);

  const handleOpenFolder = useCallback(async () => {
    if (lastSessionPath) {
      await openFolder(lastSessionPath);
    }
  }, [lastSessionPath]);

  if (!isOpen) return null;

  const isDownloading =
    downloadProgress?.status === 'preparing' ||
    downloadProgress?.status === 'downloading';
  const isComplete = downloadProgress?.status === 'complete';
  const hasError = downloadProgress?.status === 'error';

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-primary rounded-xl shadow-elevated overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-primary-lighter flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <h2 className="text-white text-xl font-semibold">Collection Manager</h2>
              <p className="text-text-muted text-xs">
                Set targets per category and download training data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDownloading}
            className="text-text-secondary hover:text-white transition-colors disabled:opacity-50"
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
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Server Status Banner */}
        {serverOnline === false && (
          <div className="px-6 py-3 bg-red-600/20 border-b border-red-500/50">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                File server is not running. Start it with:{' '}
                <code className="bg-red-900/50 px-2 py-0.5 rounded">npm run file-server</code>
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Download Progress/Complete View */}
          {(isDownloading || isComplete || hasError) && (
            <div className="bg-primary-lighter rounded-xl p-6 border border-border">
              {isDownloading && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full" />
                    <span className="text-white font-medium">
                      {downloadProgress?.status === 'preparing'
                        ? 'Preparing images...'
                        : 'Saving to disk...'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 bg-primary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 transition-all duration-300"
                        style={{
                          width: `${
                            downloadProgress
                              ? (downloadProgress.completed / downloadProgress.total) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="text-text-muted text-xs">
                      {downloadProgress?.currentFile}
                    </p>
                  </div>
                </div>
              )}

              {isComplete && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-green-400">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-lg font-semibold">Download Complete!</span>
                  </div>
                  <p className="text-text-secondary text-sm">
                    {downloadProgress?.total} images saved to Documents/Visionloop
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleOpenFolder}
                      className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-all"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                      Open Folder
                    </button>
                    <button
                      onClick={() => {
                        setDownloadProgress(null);
                      }}
                      className="px-4 py-2 bg-primary-lighter hover:bg-primary-lighter/70 text-text-secondary border border-border rounded-lg transition-all"
                    >
                      Download More
                    </button>
                  </div>
                </div>
              )}

              {hasError && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-red-400">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-lg font-semibold">Download Failed</span>
                  </div>
                  <p className="text-red-300 text-sm">{downloadProgress?.error}</p>
                  <button
                    onClick={() => setDownloadProgress(null)}
                    className="px-4 py-2 bg-primary-lighter hover:bg-primary-lighter/70 text-text-secondary border border-border rounded-lg transition-all"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Normal View */}
          {!isDownloading && !isComplete && !hasError && (
            <>
              {/* Random Sampling Section */}
              <RandomSamplingCard
                onDownload={handleDownloadRandomSamples}
                serverOnline={serverOnline !== false}
                totalCollected={totalAvailable}
              />

              {/* Controls Row */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Filter Buttons */}
                <div className="flex items-center gap-2">
                  <span className="text-text-muted text-xs">Filter:</span>
                  <button
                    onClick={() => setResultFilter('all')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      resultFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-primary-lighter text-text-secondary hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setResultFilter('fail')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      resultFilter === 'fail'
                        ? 'bg-red-600 text-white'
                        : 'bg-primary-lighter text-text-secondary hover:text-white'
                    }`}
                  >
                    FAIL
                  </button>
                  <button
                    onClick={() => setResultFilter('pass')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      resultFilter === 'pass'
                        ? 'bg-green-600 text-white'
                        : 'bg-primary-lighter text-text-secondary hover:text-white'
                    }`}
                  >
                    PASS
                  </button>
                </div>

                {/* Sort Buttons */}
                <div className="flex items-center gap-2">
                  <span className="text-text-muted text-xs">Sort:</span>
                  <button
                    onClick={() => setSortMode('rarest')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      sortMode === 'rarest'
                        ? 'bg-purple-600 text-white'
                        : 'bg-primary-lighter text-text-secondary hover:text-white'
                    }`}
                  >
                    Rarest First
                  </button>
                  <button
                    onClick={() => setSortMode('count')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      sortMode === 'count'
                        ? 'bg-purple-600 text-white'
                        : 'bg-primary-lighter text-text-secondary hover:text-white'
                    }`}
                  >
                    Most Common
                  </button>
                  <button
                    onClick={() => setSortMode('alphabetical')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      sortMode === 'alphabetical'
                        ? 'bg-purple-600 text-white'
                        : 'bg-primary-lighter text-text-secondary hover:text-white'
                    }`}
                  >
                    A-Z
                  </button>
                </div>
              </div>

              {/* Bulk Target Controls */}
              <div className="bg-primary-lighter rounded-xl p-4 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <svg
                    className="w-5 h-5 text-cyan-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
                  </svg>
                  <span className="text-white font-semibold text-sm">Bulk Target Setting</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-text-muted text-xs">Target:</label>
                    <input
                      type="number"
                      min="1"
                      value={bulkTarget}
                      onChange={(e) => setBulkTarget(e.target.value)}
                      className="w-20 px-2 py-1.5 bg-primary border border-border rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <button
                    onClick={handleSetAllTargets}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium rounded transition-all"
                  >
                    Set All to {bulkTarget}
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-text-muted text-xs">Rare threshold:</span>
                    <input
                      type="number"
                      min="1"
                      value={rareThreshold}
                      onChange={(e) => setRareThreshold(e.target.value)}
                      className="w-20 px-2 py-1.5 bg-primary border border-border rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <button
                    onClick={handleSetRareTargets}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded transition-all"
                  >
                    Set Rare Tags to {bulkTarget}
                  </button>

                  <button
                    onClick={handleClearAllTargets}
                    className="px-3 py-1.5 bg-primary hover:bg-primary/70 text-text-secondary text-xs font-medium rounded border border-border transition-all"
                  >
                    Clear All Targets
                  </button>
                </div>

                <p className="text-text-muted text-xs mt-2">
                  Tip: Use "Set Rare Tags" to target defects with fewer than {rareThreshold} samples
                </p>
              </div>

              {/* Categories Grid */}
              {tagStats.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-text-secondary text-sm font-medium">
                      Categories ({tagStats.length}) - {totalAvailable} total images
                    </p>
                    {downloadSummary.categoriesWithTargets > 0 && (
                      <p className="text-cyan-400 text-sm">
                        {downloadSummary.totalImages} images from {downloadSummary.categoriesWithTargets} categories ready to download
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {tagStats.map((stat) => (
                      <CategoryCard
                        key={stat.tag}
                        stats={{ ...stat, color: stat.color || tagColors[stat.tag] }}
                        target={targets[stat.tag] || 0}
                        onTargetChange={(target) => handleTargetChange(stat.tag, target)}
                        onClearTarget={() => handleClearTarget(stat.tag)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg
                    className="w-16 h-16 mx-auto text-text-muted mb-4"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-text-secondary text-lg font-medium">No images collected</p>
                  <p className="text-text-muted text-sm mt-1">
                    Images will appear here as they arrive from the WebSocket stream
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isDownloading && !isComplete && (
          <div className="border-t border-border px-6 py-4 bg-primary-lighter flex items-center justify-between flex-shrink-0">
            <div className="text-text-secondary text-sm">
              {downloadSummary.totalImages > 0 ? (
                <span>
                  Ready to download{' '}
                  <span className="text-white font-medium">{downloadSummary.totalImages}</span> images
                  from{' '}
                  <span className="text-white font-medium">{downloadSummary.categoriesWithTargets}</span>{' '}
                  {downloadSummary.categoriesWithTargets === 1 ? 'category' : 'categories'}
                </span>
              ) : (
                <span>Set targets on categories to download images</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-primary-lighter hover:bg-primary-lighter/70 border border-border rounded-lg text-text-secondary transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDownloadTargets}
                disabled={downloadSummary.totalImages === 0 || serverOnline === false}
                className="flex items-center gap-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-all"
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
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download to Targets
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
