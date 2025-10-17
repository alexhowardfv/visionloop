'use client';

import React from 'react';
import { BatchCarouselProps } from '@/types';

export const BatchCarousel: React.FC<BatchCarouselProps> = ({
  batchQueue,
  currentIndex,
  onNavigate,
  isVisible,
}) => {
  if (!isVisible || batchQueue.length === 0) {
    return null;
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getPassFailCount = (batch: typeof batchQueue[0]) => {
    const passCount = batch.rois.filter((r) => r.result === 'PASS').length;
    const failCount = batch.rois.filter((r) => r.result === 'FAIL').length;
    return { passCount, failCount };
  };

  return (
    <div className="w-full bg-primary/60 backdrop-blur-glass border-b border-border py-4 px-6">
      <div className="flex items-center gap-2">
        <span className="text-text-secondary text-sm font-medium mr-4">Batch Queue:</span>

        {batchQueue.map((batch, index) => {
          const { passCount, failCount } = getPassFailCount(batch);
          const isActive = index === currentIndex;

          return (
            <button
              key={batch.id}
              onClick={() => onNavigate(index)}
              className={`relative w-[200px] rounded-lg transition-all ${
                isActive
                  ? 'bg-blue-600 shadow-lg scale-105'
                  : 'bg-primary-lighter hover:bg-primary-lighter/80'
              }`}
            >
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-text-secondary'}`}>
                    Batch #{index + 1}
                  </span>
                  <span
                    className={`text-xs ${
                      isActive ? 'text-blue-200' : 'text-text-muted'
                    }`}
                  >
                    {formatTimestamp(batch.timestamp)}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-status-pass"></div>
                    <span className={isActive ? 'text-white' : 'text-text-secondary'}>
                      {passCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-status-fail"></div>
                    <span className={isActive ? 'text-white' : 'text-text-secondary'}>
                      {failCount}
                    </span>
                  </div>
                  <div
                    className={`ml-auto px-2 py-0.5 rounded ${
                      batch.overallStatus === 'PASS'
                        ? 'bg-status-pass/20 text-status-pass'
                        : batch.overallStatus === 'FAIL'
                        ? 'bg-status-fail/20 text-status-fail'
                        : 'bg-status-unknown/20 text-status-unknown'
                    }`}
                  >
                    {batch.overallStatus}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Navigation Arrows */}
      <div className="flex items-center justify-center gap-2 mt-3">
        <button
          onClick={() => onNavigate(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="px-3 py-1 rounded bg-primary-lighter text-text-secondary text-sm hover:bg-primary-lighter/80 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>
        <span className="text-text-muted text-xs">
          {currentIndex + 1} of {batchQueue.length}
        </span>
        <button
          onClick={() => onNavigate(Math.min(batchQueue.length - 1, currentIndex + 1))}
          disabled={currentIndex === batchQueue.length - 1}
          className="px-3 py-1 rounded bg-primary-lighter text-text-secondary text-sm hover:bg-primary-lighter/80 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </div>
  );
};
