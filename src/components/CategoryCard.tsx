'use client';

import React, { useState, useEffect } from 'react';
import { TagStats } from '@/lib/collectionStore';
import { Tooltip } from './Tooltip';

interface CategoryCardProps {
  stats: TagStats;
  target: number;
  onTargetChange: (target: number) => void;
  onClearTarget: () => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  stats,
  target,
  onTargetChange,
  onClearTarget,
}) => {
  const [inputValue, setInputValue] = useState<string>(target > 0 ? target.toString() : '');

  // Sync input with prop changes (e.g., from bulk set)
  useEffect(() => {
    setInputValue(target > 0 ? target.toString() : '');
  }, [target]);

  const hasTarget = target > 0;
  const canDownload = Math.min(target, stats.count);
  const progressPercent = hasTarget ? Math.min(100, (stats.count / target) * 100) : 0;
  const targetMet = stats.count >= target && hasTarget;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const num = parseInt(inputValue, 10);
    if (!isNaN(num) && num > 0) {
      onTargetChange(num);
    } else if (inputValue === '' || inputValue === '0') {
      onClearTarget();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    }
  };

  const handleQuickSet = (value: number) => {
    setInputValue(value.toString());
    onTargetChange(value);
  };

  return (
    <div
      className={`relative bg-primary-lighter rounded-xl border-2 transition-all duration-200 overflow-hidden ${
        hasTarget
          ? targetMet
            ? 'border-green-500 shadow-lg shadow-green-500/20'
            : 'border-cyan-500 shadow-lg shadow-cyan-500/20'
          : 'border-border hover:border-border/80'
      }`}
    >
      {/* Status Badge */}
      {hasTarget && (
        <div
          className={`absolute top-0 left-0 right-0 text-white text-xs font-bold px-2 py-1 text-center z-10 ${
            targetMet ? 'bg-green-600/90' : 'bg-cyan-600/90'
          }`}
        >
          {targetMet ? (
            <span className="flex items-center justify-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Target Met ({stats.count}/{target})
            </span>
          ) : (
            `${canDownload}/${target} available`
          )}
        </div>
      )}

      {/* Thumbnail Preview */}
      <div className={`aspect-video bg-primary relative overflow-hidden ${hasTarget ? 'mt-6' : ''}`}>
        {stats.thumbnail ? (
          <img
            src={stats.thumbnail}
            alt={stats.tag}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted">
            <svg
              className="w-12 h-12"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Tag Color Indicator */}
        {stats.color && (
          <div
            className="absolute top-2 left-2 w-4 h-4 rounded-full border-2 border-white shadow"
            style={{ backgroundColor: stats.color }}
          />
        )}

        {/* Count Badge */}
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded">
          {stats.count} collected
        </div>
      </div>

      {/* Card Content */}
      <div className="p-3 space-y-3">
        {/* Tag Name & Stats */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-sm truncate" title={stats.tag}>
              {stats.tag}
            </h3>
            <div className="flex items-center gap-2 text-xs">
              {stats.failCount > 0 && (
                <span className="text-red-400">{stats.failCount} fail</span>
              )}
              {stats.passCount > 0 && (
                <span className="text-green-400">{stats.passCount} pass</span>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar (when target set) */}
        {hasTarget && (
          <div className="space-y-1">
            <div className="h-1.5 bg-primary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  targetMet ? 'bg-green-500' : progressPercent >= 50 ? 'bg-cyan-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Target Input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-text-muted text-xs flex-shrink-0">Target:</label>
            <input
              type="number"
              min="0"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              placeholder="0"
              className={`flex-1 px-2 py-1.5 bg-primary border rounded text-white text-sm focus:outline-none focus:ring-1 ${
                hasTarget
                  ? 'border-cyan-500/50 focus:ring-cyan-500'
                  : 'border-border focus:ring-blue-500'
              }`}
            />
            {hasTarget && (
              <Tooltip content="Clear target" position="top">
                <button
                  onClick={onClearTarget}
                  className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </Tooltip>
            )}
          </div>

          {/* Quick Set Buttons */}
          <div className="flex items-center gap-1">
            {[25, 50, 100].map((preset) => (
              <button
                key={preset}
                onClick={() => handleQuickSet(preset)}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-all ${
                  target === preset
                    ? 'bg-cyan-600 text-white'
                    : 'bg-primary hover:bg-primary/70 text-text-secondary'
                }`}
              >
                {preset}
              </button>
            ))}
            <Tooltip content="Set target to all available" position="top">
              <button
                onClick={() => handleQuickSet(stats.count)}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-all ${
                  target === stats.count
                    ? 'bg-cyan-600 text-white'
                    : 'bg-primary hover:bg-primary/70 text-text-secondary'
                }`}
              >
                ALL
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};
