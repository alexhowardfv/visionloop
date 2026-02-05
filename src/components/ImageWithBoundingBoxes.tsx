'use client';

import { useEffect, useRef, useState } from 'react';
import { BoundingBox } from '@/types';

interface ImageDimensions {
  imageDimensions: { width: number; height: number };
  imagePosition: { left: number; top: number };
  naturalDimensions?: { width: number; height: number };
}

interface ImageWithBoundingBoxesProps {
  src: string;
  alt: string;
  detections?: BoundingBox[];
  className?: string;
  zoom?: number;
  showLabels?: boolean;
  onDimensionsCalculated?: (dims: ImageDimensions) => void;
  hideBoundingBoxes?: boolean; // Hide built-in bounding boxes when using AnnotationLayer
}

export const ImageWithBoundingBoxes = ({
  src,
  alt,
  detections,
  className = '',
  zoom = 1,
  showLabels = true,
  onDimensionsCalculated,
  hideBoundingBoxes = false,
}: ImageWithBoundingBoxesProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [imagePosition, setImagePosition] = useState({ left: 0, top: 0 });

  useEffect(() => {
    const img = imageRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    const updateDimensions = () => {
      // Get natural image dimensions
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;

      // Get container dimensions
      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;

      if (naturalWidth === 0 || naturalHeight === 0) return;

      // Calculate how object-contain scales the image
      const imageAspect = naturalWidth / naturalHeight;
      const containerAspect = containerWidth / containerHeight;

      let displayedWidth, displayedHeight, offsetX, offsetY;

      if (imageAspect > containerAspect) {
        // Image is wider than container - width constrained
        displayedWidth = containerWidth;
        displayedHeight = containerWidth / imageAspect;
        offsetX = 0;
        offsetY = (containerHeight - displayedHeight) / 2;
      } else {
        // Image is taller than container - height constrained
        displayedHeight = containerHeight;
        displayedWidth = containerHeight * imageAspect;
        offsetY = 0;
        offsetX = (containerWidth - displayedWidth) / 2;
      }

      const newDimensions = {
        width: displayedWidth,
        height: displayedHeight,
      };
      const newPosition = {
        left: offsetX,
        top: offsetY,
      };

      setImageDimensions(newDimensions);
      setImagePosition(newPosition);

      // Notify parent of dimension changes
      if (onDimensionsCalculated) {
        onDimensionsCalculated({
          imageDimensions: newDimensions,
          imagePosition: newPosition,
          naturalDimensions: { width: naturalWidth, height: naturalHeight },
        });
      }
    };

    // Update dimensions when image loads
    if (img.complete) {
      updateDimensions();
    }

    img.addEventListener('load', updateDimensions);
    window.addEventListener('resize', updateDimensions);

    return () => {
      img.removeEventListener('load', updateDimensions);
      window.removeEventListener('resize', updateDimensions);
    };
  }, [src, onDimensionsCalculated]);

  // Update dimensions when zoom changes
  useEffect(() => {
    const img = imageRef.current;
    const container = containerRef.current;
    if (img && container && img.complete) {
      // Get natural image dimensions
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;

      // Get container dimensions
      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;

      if (naturalWidth === 0 || naturalHeight === 0) return;

      // Calculate how object-contain scales the image
      const imageAspect = naturalWidth / naturalHeight;
      const containerAspect = containerWidth / containerHeight;

      let displayedWidth, displayedHeight, offsetX, offsetY;

      if (imageAspect > containerAspect) {
        // Image is wider than container - width constrained
        displayedWidth = containerWidth;
        displayedHeight = containerWidth / imageAspect;
        offsetX = 0;
        offsetY = (containerHeight - displayedHeight) / 2;
      } else {
        // Image is taller than container - height constrained
        displayedHeight = containerHeight;
        displayedWidth = containerHeight * imageAspect;
        offsetY = 0;
        offsetX = (containerWidth - displayedWidth) / 2;
      }

      const newDimensions = {
        width: displayedWidth,
        height: displayedHeight,
      };
      const newPosition = {
        left: offsetX,
        top: offsetY,
      };

      setImageDimensions(newDimensions);
      setImagePosition(newPosition);

      // Notify parent of dimension changes
      if (onDimensionsCalculated) {
        onDimensionsCalculated({
          imageDimensions: newDimensions,
          imagePosition: newPosition,
          naturalDimensions: { width: naturalWidth, height: naturalHeight },
        });
      }
    }
  }, [zoom, onDimensionsCalculated]);

  // Debug logging
  useEffect(() => {
    if (detections && detections.length > 0) {
      console.log('[ImageWithBoundingBoxes] Image dimensions (W x H):',
        `${imageDimensions.width} x ${imageDimensions.height}`);
      console.log('[ImageWithBoundingBoxes] First detection (normalized):', detections[0]);

      if (imageDimensions.width > 0) {
        const box = detections[0];
        const isNormalized = box.x <= 1 && box.y <= 1 && box.width <= 1 && box.height <= 1;
        if (isNormalized) {
          const scaledX = box.x * imageDimensions.width;
          const scaledY = box.y * imageDimensions.height;
          const scaledW = box.width * imageDimensions.width;
          const scaledH = box.height * imageDimensions.height;
          console.log('[ImageWithBoundingBoxes] First detection (scaled):',
            `x=${scaledX.toFixed(1)}, y=${scaledY.toFixed(1)}, w=${scaledW.toFixed(1)}, h=${scaledH.toFixed(1)}`);
        }
      }
    }
  }, [detections, imageDimensions]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className="w-full h-full object-contain"
      />

      {/* Bounding boxes overlay - hidden when using AnnotationLayer */}
      {!hideBoundingBoxes && detections && detections.length > 0 && imageDimensions.width > 0 && (
        <svg
          className="absolute pointer-events-none"
          style={{
            left: `${imagePosition.left}px`,
            top: `${imagePosition.top}px`,
            width: `${imageDimensions.width}px`,
            height: `${imageDimensions.height}px`,
          }}
          viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {detections.map((box, index) => {
            // Bounding box coordinates are in pixels relative to displayed image
            // If coordinates seem to be normalized (0-1), scale them up
            const isNormalized = box.x <= 1 && box.y <= 1 && box.width <= 1 && box.height <= 1;

            // Scale by the displayed image dimensions
            const x = isNormalized ? box.x * imageDimensions.width : box.x;
            const y = isNormalized ? box.y * imageDimensions.height : box.y;
            const width = isNormalized ? box.width * imageDimensions.width : box.width;
            const height = isNormalized ? box.height * imageDimensions.height : box.height;

            // Use color from bounding box if available, otherwise fallback to index-based colors
            const fallbackColors = [
              '#ef4444', // red
              '#f59e0b', // amber
              '#10b981', // emerald
              '#3b82f6', // blue
              '#8b5cf6', // violet
              '#ec4899', // pink
            ];
            const color = box.color || fallbackColors[index % fallbackColors.length];

            // Calculate stroke width and label size that scale with zoom
            const strokeWidth = 2.5;
            const labelHeight = 22;
            const fontSize = 13;

            return (
              <g key={index}>
                {/* Bounding box rectangle */}
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeDasharray="none"
                />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
};
