'use client';

import React, { useState } from 'react';
import { getTotalCount, ResultFilter } from '@/lib/collectionStore';

interface RandomSamplingCardProps {
  onDownload: (count: number, filter: ResultFilter) => void;
  serverOnline: boolean;
  totalCollected: number;
}

const COUNT_PRESETS = [25, 50, 100, 200];

export const RandomSamplingCard: React.FC<RandomSamplingCardProps> = ({
  onDownload,
  serverOnline,
  totalCollected,
}) => {
  const [sampleCount, setSampleCount] = useState<number>(100);
  const [filter, setFilter] = useState<ResultFilter>('all');

  const maxAvailable = totalCollected;
  const actualCount = Math.min(sampleCount, maxAvailable);

  return (
    <div className="bg-primary-lighter rounded-xl border-2 border-orange-500/50 transition-all duration-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-600">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Random Sampling</h3>
            <p className="text-text-muted text-xs">
              Pick random images from your collection for validation
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Visual: From X take Y */}
        <div className="bg-primary rounded-lg p-4">
          <div className="flex items-center justify-center gap-3">
            {/* FROM */}
            <div className="text-center">
              <p className="text-text-muted text-xs uppercase tracking-wide mb-1">From</p>
              <p className="text-white text-3xl font-bold">{maxAvailable.toLocaleString()}</p>
              <p className="text-text-muted text-xs">collected</p>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center px-4">
              <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className="text-orange-400 text-xs font-medium">random pick</span>
            </div>

            {/* TAKE */}
            <div className="text-center">
              <p className="text-text-muted text-xs uppercase tracking-wide mb-1">Take</p>
              <input
                type="number"
                min="1"
                max={maxAvailable}
                value={sampleCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val > 0) setSampleCount(val);
                }}
                className="w-24 text-3xl font-bold text-center bg-transparent text-orange-400 border-b-2 border-orange-500 focus:outline-none"
              />
              <p className="text-text-muted text-xs">samples</p>
            </div>
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs">Quick:</span>
          {COUNT_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setSampleCount(preset)}
              disabled={preset > maxAvailable}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                sampleCount === preset
                  ? 'bg-orange-600 text-white'
                  : preset > maxAvailable
                  ? 'bg-primary/50 text-text-muted cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/70 text-text-secondary'
              }`}
            >
              {preset}
            </button>
          ))}
          <button
            onClick={() => setSampleCount(maxAvailable)}
            disabled={maxAvailable === 0}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
              sampleCount === maxAvailable && maxAvailable > 0
                ? 'bg-orange-600 text-white'
                : maxAvailable === 0
                ? 'bg-primary/50 text-text-muted cursor-not-allowed'
                : 'bg-primary hover:bg-primary/70 text-text-secondary'
            }`}
          >
            ALL
          </button>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs">Filter:</span>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-primary hover:bg-primary/70 text-text-secondary'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('fail')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              filter === 'fail'
                ? 'bg-red-600 text-white'
                : 'bg-primary hover:bg-primary/70 text-text-secondary'
            }`}
          >
            FAIL
          </button>
          <button
            onClick={() => setFilter('pass')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              filter === 'pass'
                ? 'bg-green-600 text-white'
                : 'bg-primary hover:bg-primary/70 text-text-secondary'
            }`}
          >
            PASS
          </button>
        </div>

        {/* Download Button */}
        <button
          onClick={() => onDownload(sampleCount, filter)}
          disabled={maxAvailable === 0 || !serverOnline}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-all"
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
          Download {actualCount} Random Samples
        </button>
      </div>
    </div>
  );
};
