'use client';

import React, { useMemo } from 'react';
import { ImageGridProps } from '@/types';
import { ImageCard } from './ImageCard';

export const ImageGrid: React.FC<ImageGridProps> = ({
  rois,
  selectedImages,
  onToggleSelection,
  cameraFilter,
}) => {
  const filteredROIs = useMemo(() => {
    if (cameraFilter === 'all') {
      return rois;
    }
    // Filter by camera - this is a simplified filter
    // You can enhance this based on actual camera grouping logic
    return rois.filter((roi) => roi.cameraId.toLowerCase().includes(cameraFilter.toLowerCase()));
  }, [rois, cameraFilter]);

  const getImageKey = (roi: { batchId: string; boxNumber: number }) =>
    `${roi.batchId}_${roi.boxNumber}`;

  return (
    <div className="w-full h-full overflow-auto p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
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
