'use client';

import React, { useMemo } from 'react';
import { ImageGridProps } from '@/types';
import { ImageCard } from './ImageCard';

function getOptimalColumns(count: number, isPortrait = false): number {
  if (isPortrait) {
    if (count <= 1) return 1;
    if (count <= 2) return 1;
    if (count <= 4) return 2;
    if (count <= 6) return 2;
    if (count <= 12) return 3;
    if (count <= 20) return 4;
    return 4;
  }
  if (count <= 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  if (count === 4) return 2;
  if (count <= 6) return 3;
  if (count <= 8) return 4;
  if (count <= 12) return 4;
  if (count <= 20) return 5;
  return 6;
}

export const ImageGrid: React.FC<ImageGridProps> = ({
  rois,
  selectedImages,
  onToggleSelection,
  cameraFilter,
  isPortrait,
}) => {
  const filteredROIs = useMemo(() => {
    if (cameraFilter === 'all') {
      return rois;
    }
    return rois.filter((roi) => roi.cameraId.toLowerCase().includes(cameraFilter.toLowerCase()));
  }, [rois, cameraFilter]);

  const columns = useMemo(() => getOptimalColumns(filteredROIs.length, isPortrait), [filteredROIs.length, isPortrait]);

  const getImageKey = (roi: { batchId: string; boxNumber: number }) =>
    `${roi.batchId}_${roi.boxNumber}`;

  // Constrain max width for small counts so cards don't fill the viewport
  const maxWidth = filteredROIs.length <= 1 ? '750px'
    : filteredROIs.length <= 2 ? '1000px'
    : undefined;

  const isQuadrant = filteredROIs.length === 4;

  if (isQuadrant) {
    return (
      <div className="w-full h-full overflow-hidden p-3">
        <div className="grid grid-cols-2 grid-rows-2 h-full">
          {filteredROIs.map((roi) => (
            <div key={getImageKey(roi)} className="flex items-center justify-center p-3 min-h-0">
              <div className="w-[95%]">
                <ImageCard
                  roi={roi}
                  isSelected={selectedImages.has(getImageKey(roi))}
                  onToggleSelection={() => onToggleSelection(roi.batchId, roi.boxNumber)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto p-6">
      <div
        className="grid gap-4 mx-auto"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          maxWidth,
        }}
      >
        {filteredROIs.map((roi) => (
          <ImageCard
            key={getImageKey(roi)}
            roi={roi}
            isSelected={selectedImages.has(getImageKey(roi))}
            onToggleSelection={() => onToggleSelection(roi.batchId, roi.boxNumber)}
          />
        ))}
      </div>

      {filteredROIs.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-text-secondary text-lg">No images available</p>
            <p className="text-text-muted text-sm mt-2">Waiting for inspection data...</p>
          </div>
        </div>
      )}
    </div>
  );
};
