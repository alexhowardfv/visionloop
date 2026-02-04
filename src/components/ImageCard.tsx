'use client';

import React from 'react';
import { ImageCardProps } from '@/types';
import { ImageWithBoundingBoxes } from './ImageWithBoundingBoxes';

export const ImageCard: React.FC<ImageCardProps> = ({ roi, isSelected, onToggleSelection }) => {
  const getGradientBorderClass = () => {
    switch (roi.result) {
      case 'PASS':
        return 'gradient-border gradient-border-pass';
      case 'FAIL':
        return 'gradient-border gradient-border-fail';
      default:
        return 'gradient-border gradient-border-subtle';
    }
  };

  const hasImage = roi.imageData && roi.imageData.length > 0;

  return (
    <div
      className={`relative group overflow-hidden transition-all cursor-pointer ${
        hasImage ? getGradientBorderClass() : 'rounded-lg border-2 border-dashed border-border'
      } ${isSelected ? 'ring-4 ring-blue-500 shadow-glow-cyan' : ''}`}
      onClick={onToggleSelection}
    >
      {/* Image or Placeholder */}
      <div className="aspect-video bg-primary-lighter flex items-center justify-center relative">
        {hasImage ? (
          <ImageWithBoundingBoxes
            src={roi.imageData}
            alt={`Camera ${roi.cameraId}`}
            detections={roi.detections}
            className="w-full h-full"
            showLabels={true}
          />
        ) : (
          <div className="text-text-muted text-sm">No Image</div>
        )}

        {/* Selection Checkbox */}
        <div className="absolute top-2 right-2">
          <div
            className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
              isSelected ? 'bg-blue-600' : 'bg-black/50 group-hover:bg-black/70'
            }`}
          >
            {isSelected && (
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M5 13l4 4L19 7"></path>
              </svg>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="absolute bottom-2 left-2">
          <div
            className={`px-2 py-1 rounded text-xs font-medium font-display tracking-wider ${
              roi.result === 'PASS'
                ? 'bg-status-pass/20 text-status-pass text-glow-green'
                : roi.result === 'FAIL'
                ? 'bg-status-fail/20 text-status-fail text-glow-red'
                : 'bg-status-unknown/20 text-status-unknown'
            }`}
          >
            {roi.result}
          </div>
        </div>
      </div>

      {/* Info Bar */}
      <div className="bg-primary/60 px-3 py-2 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-text-secondary text-xs font-medium">{roi.cameraId}</span>
          <span className="text-text-muted text-xs">Box {roi.boxNumber}</span>
        </div>
        {roi.reason && roi.result !== 'PASS' && (
          <p className="text-text-muted text-xs mt-1 truncate" title={roi.reason}>
            {roi.reason}
          </p>
        )}
      </div>
    </div>
  );
};
