'use client';

import React, { useState, useRef, useLayoutEffect } from 'react';
import { BatchCarouselProps } from '@/types';

export const BatchCarousel: React.FC<BatchCarouselProps> = ({
  batchQueue,
  currentIndex,
  onNavigate,
  selectedImages,
  overallStatus = 'UNKNOWN',
  maxQueueSize,
}) => {
  // Track hover by batch ID so tooltip follows the correct batch when indices shift
  const [hoveredBatchId, setHoveredBatchId] = useState<string | null>(null);

  // FLIP animation refs
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevPositions = useRef<Map<string, DOMRect>>(new Map());
  const prevBatchIds = useRef<string>('');

  // FLIP: after DOM commits (before paint), compare old vs new positions and animate
  useLayoutEffect(() => {
    // Only animate when the batch queue actually changes, not on hover re-renders
    const currentBatchIds = batchQueue.map((b) => b.id).join(',');
    const batchesChanged = currentBatchIds !== prevBatchIds.current;
    prevBatchIds.current = currentBatchIds;

    if (!batchesChanged) return;

    const prevMap = prevPositions.current;

    // Cancel any in-progress transitions so getBoundingClientRect returns
    // the true layout position, not a mid-animation visual position
    cardRefs.current.forEach((el) => {
      el.style.transition = 'none';
      el.style.transform = '';
      el.style.opacity = '';
    });

    // Capture new layout positions BEFORE starting animations
    // (transitions are cancelled so these are accurate layout positions)
    const newPositions = new Map<string, DOMRect>();
    cardRefs.current.forEach((el, id) => {
      newPositions.set(id, el.getBoundingClientRect());
    });

    // Animate each card
    cardRefs.current.forEach((el, id) => {
      const prevRect = prevMap.get(id);
      const newRect = newPositions.get(id)!;

      if (!prevRect) {
        // New card: entrance animation (fade + scale in)
        el.style.opacity = '0';
        el.style.transform = 'scale(0.5)';
        void el.offsetHeight;
        el.style.transition = 'opacity 300ms ease-out, transform 300ms ease-out';
        el.style.opacity = '1';
        el.style.transform = '';
        return;
      }

      const deltaX = prevRect.left - newRect.left;

      if (Math.abs(deltaX) > 1) {
        // Invert: snap to old position
        el.style.transform = `translateX(${deltaX}px)`;
        void el.offsetHeight;

        // Play: animate to new (actual) position
        el.style.transition = 'transform 300ms ease-out';
        el.style.transform = '';
      }
    });

    // Store positions for next batch change
    prevPositions.current = newPositions;

    // Prune refs for batches that left the queue
    const currentIds = new Set(batchQueue.map((b) => b.id));
    for (const id of [...cardRefs.current.keys()]) {
      if (!currentIds.has(id)) cardRefs.current.delete(id);
    }
    for (const id of [...prevPositions.current.keys()]) {
      if (!currentIds.has(id)) prevPositions.current.delete(id);
    }
  });

  if (batchQueue.length === 0) {
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

  const getSelectedCount = (batchId: string) => {
    if (!selectedImages) return 0;
    let count = 0;
    for (const key of selectedImages.keys()) {
      if (key.startsWith(batchId + '_')) count++;
    }
    return count;
  };

  return (
    <div className="relative z-10 w-full bg-primary/60 backdrop-blur-glass py-1.5 overflow-x-clip overflow-y-visible">
      <div className="relative flex items-center justify-center gap-1.5 h-11 px-[50px]">
        {/* Overall status indicator - anchored left */}
        <div className={`absolute left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-md flex-shrink-0 ${
          overallStatus === 'PASS'
            ? 'bg-status-pass/20 text-status-pass'
            : overallStatus === 'FAIL'
            ? 'bg-status-fail/20 text-status-fail'
            : 'bg-status-unknown/20 text-status-unknown'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            overallStatus === 'PASS'
              ? 'bg-status-pass'
              : overallStatus === 'FAIL'
              ? 'bg-status-fail'
              : 'bg-status-unknown'
          }`}></div>
          <span className="text-xs font-semibold">{overallStatus}</span>
        </div>

        <span className="text-text-secondary text-sm font-medium mr-2 flex-shrink-0">
          Queue ({batchQueue.length}{maxQueueSize ? `/${maxQueueSize}` : ''})
        </span>

        {batchQueue.map((batch, index) => {
          const isActive = index === currentIndex;
          const isHovered = hoveredBatchId === batch.id;

          // How close to being popped: 0 = first to go, 1 = second, 2 = third
          const queueFull = maxQueueSize ? batchQueue.length >= maxQueueSize - 1 : false;
          const expiringSoon = queueFull && index <= 2 ? index : -1;

          const cardColor =
            batch.overallStatus === 'PASS'
              ? isActive ? 'bg-green-600' : 'bg-green-800/60 hover:bg-green-700/70'
              : batch.overallStatus === 'FAIL'
              ? isActive ? 'bg-red-600' : 'bg-red-800/60 hover:bg-red-700/70'
              : isActive ? 'bg-yellow-600' : 'bg-yellow-800/40 hover:bg-yellow-700/50';

          const expiringStyle = expiringSoon === 0
            ? 'animate-glow-pulse'
            : expiringSoon === 1
            ? 'animate-glow-pulse-mid'
            : expiringSoon === 2
            ? 'shadow-glow-red-soft'
            : '';

          return (
            <div
              key={batch.id}
              ref={(el) => {
                if (el) cardRefs.current.set(batch.id, el);
                else cardRefs.current.delete(batch.id);
              }}
              className="relative"
            >
              <button
                onClick={() => onNavigate(index)}
                onMouseEnter={() => setHoveredBatchId(batch.id)}
                onMouseLeave={() => setHoveredBatchId(null)}
                className={`w-11 h-8 rounded-md transition-all flex items-center justify-center ${cardColor} ${
                  isActive ? 'scale-y-110' : ''
                } ${expiringStyle}`}
              >
                <span className={`text-[15px] font-medium leading-none ${isActive ? 'text-white' : 'text-white/70'}`}>
                  {batchQueue.length - index}
                </span>
              </button>
              {/* Selected images badge */}
              {(() => {
                const selCount = getSelectedCount(batch.id);
                return selCount > 0 ? (
                  <div className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center z-10 pointer-events-none">
                    {selCount}
                  </div>
                ) : null;
              })()}

              {/* Expanded popover on hover */}
              {isHovered && (() => {
                const { passCount, failCount } = getPassFailCount(batch);
                return (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 pointer-events-none">
                    <div className="w-[200px] bg-primary-lighter border border-border rounded-lg shadow-xl">
                      <div className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-white whitespace-nowrap">
                            Batch&nbsp;#{batchQueue.length - index}
                          </span>
                          <span className="text-xs text-text-muted whitespace-nowrap">
                            {formatTimestamp(batch.timestamp)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-status-pass flex-shrink-0"></div>
                            <span className="text-text-secondary">{passCount}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-status-fail flex-shrink-0"></div>
                            <span className="text-text-secondary">{failCount}</span>
                          </div>
                          <div
                            className={`ml-auto px-2 py-0.5 rounded whitespace-nowrap ${
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
                    </div>
                    {/* Arrow */}
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary-lighter border-l border-t border-border rotate-45"></div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
};
