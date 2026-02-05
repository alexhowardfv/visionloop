'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { BoundingBox, ManualAnnotation } from '@/types';

interface AnnotationLayerProps {
  imageDimensions: { width: number; height: number };
  imagePosition: { left: number; top: number };
  existingDetections?: BoundingBox[];
  manualAnnotations: ManualAnnotation[];
  isAnnotationMode: boolean;
  selectedTagForDrawing: string | null;
  tagColors: Record<string, string>;
  selectedAnnotationId: string | null;
  zoom?: number;
  onAddAnnotation: (annotation: ManualAnnotation) => void;
  onUpdateAnnotation: (annotationId: string, updates: Partial<ManualAnnotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  onSelectAnnotation: (id: string | null) => void;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface DrawingState {
  isDrawing: boolean;
  startPoint: { x: number; y: number } | null;
  currentPoint: { x: number; y: number } | null;
}

interface ResizeState {
  isResizing: boolean;
  handle: ResizeHandle | null;
  annotationId: string | null;
  startPoint: { x: number; y: number } | null;
  originalShape: ManualAnnotation['shape'] | null;
}

interface DragState {
  isDragging: boolean;
  annotationId: string | null;
  startPoint: { x: number; y: number } | null;
  originalShape: ManualAnnotation['shape'] | null;
}

const MIN_BOX_SIZE = 0.005; // Minimum 0.5% of image dimension

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  imageDimensions,
  imagePosition,
  existingDetections = [],
  manualAnnotations,
  isAnnotationMode,
  selectedTagForDrawing,
  tagColors,
  selectedAnnotationId,
  zoom = 1,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onSelectAnnotation,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    startPoint: null,
    currentPoint: null,
  });
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    handle: null,
    annotationId: null,
    startPoint: null,
    originalShape: null,
  });
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    annotationId: null,
    startPoint: null,
    originalShape: null,
  });

  // Convert screen coordinates to normalized (0-1) coordinates
  const screenToNormalized = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (!svg || imageDimensions.width === 0 || imageDimensions.height === 0) return null;

      const rect = svg.getBoundingClientRect();
      // getBoundingClientRect returns scaled dimensions due to CSS transform
      // We need to account for zoom to get correct relative position
      const relX = (clientX - rect.left) / zoom;
      const relY = (clientY - rect.top) / zoom;

      return {
        x: Math.max(0, Math.min(1, relX / imageDimensions.width)),
        y: Math.max(0, Math.min(1, relY / imageDimensions.height)),
      };
    },
    [imageDimensions, zoom]
  );

  // Check if a point is inside an annotation
  const isPointInAnnotation = (point: { x: number; y: number }, annotation: ManualAnnotation): boolean => {
    const { p1, p2 } = annotation.shape;
    return point.x >= p1.x && point.x <= p2.x && point.y >= p1.y && point.y <= p2.y;
  };

  // Check if clicking on a resize handle
  const getClickedHandle = (
    point: { x: number; y: number },
    shape: ManualAnnotation['shape']
  ): ResizeHandle | null => {
    const handleSize = 0.02; // 2% of image for handle hit area
    const { p1, p2 } = shape;

    const handles: { handle: ResizeHandle; x: number; y: number }[] = [
      { handle: 'nw', x: p1.x, y: p1.y },
      { handle: 'ne', x: p2.x, y: p1.y },
      { handle: 'sw', x: p1.x, y: p2.y },
      { handle: 'se', x: p2.x, y: p2.y },
    ];

    for (const h of handles) {
      if (Math.abs(point.x - h.x) < handleSize && Math.abs(point.y - h.y) < handleSize) {
        return h.handle;
      }
    }
    return null;
  };

  // Handle mouse down - start drawing, resizing, or dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isAnnotationMode) return;

      const point = screenToNormalized(e.clientX, e.clientY);
      if (!point) return;

      // Check if clicking on a resize handle first (only for selected annotation)
      if (selectedAnnotationId) {
        const annotation = manualAnnotations.find((a) => a.id === selectedAnnotationId);
        if (annotation) {
          const handle = getClickedHandle(point, annotation.shape);
          if (handle) {
            e.stopPropagation();
            setResizeState({
              isResizing: true,
              handle,
              annotationId: selectedAnnotationId,
              startPoint: point,
              originalShape: { ...annotation.shape },
            });
            return;
          }
        }
      }

      // Check if clicking inside an existing annotation (for dragging or selection)
      const clickedAnnotation = manualAnnotations.find((a) => isPointInAnnotation(point, a));
      if (clickedAnnotation) {
        // If clicking on already selected annotation, start dragging
        if (clickedAnnotation.id === selectedAnnotationId) {
          e.stopPropagation();
          setDragState({
            isDragging: true,
            annotationId: clickedAnnotation.id,
            startPoint: point,
            originalShape: { ...clickedAnnotation.shape },
          });
        } else {
          // Select the annotation
          onSelectAnnotation(clickedAnnotation.id);
        }
        return;
      }

      // Start drawing new annotation
      if (selectedTagForDrawing) {
        onSelectAnnotation(null);
        setDrawingState({
          isDrawing: true,
          startPoint: point,
          currentPoint: point,
        });
      }
    },
    [isAnnotationMode, selectedTagForDrawing, selectedAnnotationId, manualAnnotations, screenToNormalized, onSelectAnnotation]
  );

  // Handle mouse move - update drawing preview, resize, or drag
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const point = screenToNormalized(e.clientX, e.clientY);
      if (!point) return;

      // Handle dragging
      if (dragState.isDragging && dragState.originalShape && dragState.annotationId && dragState.startPoint) {
        const deltaX = point.x - dragState.startPoint.x;
        const deltaY = point.y - dragState.startPoint.y;

        const { p1, p2 } = dragState.originalShape;
        const boxWidth = p2.x - p1.x;
        const boxHeight = p2.y - p1.y;

        // Calculate new position, clamped to image bounds
        let newP1X = p1.x + deltaX;
        let newP1Y = p1.y + deltaY;

        // Clamp to keep box within bounds
        if (newP1X < 0) newP1X = 0;
        if (newP1Y < 0) newP1Y = 0;
        if (newP1X + boxWidth > 1) newP1X = 1 - boxWidth;
        if (newP1Y + boxHeight > 1) newP1Y = 1 - boxHeight;

        const newShape = {
          p1: { x: newP1X, y: newP1Y },
          p2: { x: newP1X + boxWidth, y: newP1Y + boxHeight },
        };

        onUpdateAnnotation(dragState.annotationId, { shape: newShape });
        return;
      }

      // Handle resizing
      if (resizeState.isResizing && resizeState.handle && resizeState.originalShape && resizeState.annotationId) {
        const newShape = calculateResizedShape(resizeState.originalShape, resizeState.handle, point);
        onUpdateAnnotation(resizeState.annotationId, { shape: newShape });
        return;
      }

      // Handle drawing
      if (drawingState.isDrawing) {
        setDrawingState((prev) => ({
          ...prev,
          currentPoint: point,
        }));
      }
    },
    [drawingState.isDrawing, resizeState, dragState, screenToNormalized, onUpdateAnnotation]
  );

  // Handle mouse up - finish drawing, resizing, or dragging
  const handleMouseUp = useCallback(() => {
    // Finish dragging
    if (dragState.isDragging) {
      setDragState({
        isDragging: false,
        annotationId: null,
        startPoint: null,
        originalShape: null,
      });
      return;
    }

    // Finish resizing
    if (resizeState.isResizing) {
      setResizeState({
        isResizing: false,
        handle: null,
        annotationId: null,
        startPoint: null,
        originalShape: null,
      });
      return;
    }

    // Finish drawing
    if (drawingState.isDrawing && drawingState.startPoint && drawingState.currentPoint && selectedTagForDrawing) {
      const { startPoint, currentPoint } = drawingState;

      // Calculate normalized shape
      const p1 = {
        x: Math.min(startPoint.x, currentPoint.x),
        y: Math.min(startPoint.y, currentPoint.y),
      };
      const p2 = {
        x: Math.max(startPoint.x, currentPoint.x),
        y: Math.max(startPoint.y, currentPoint.y),
      };

      // Check minimum size
      const width = p2.x - p1.x;
      const height = p2.y - p1.y;

      if (width >= MIN_BOX_SIZE && height >= MIN_BOX_SIZE) {
        const newAnnotation: ManualAnnotation = {
          id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          index: manualAnnotations.length,
          title: selectedTagForDrawing,
          tool: 'tagBox',
          flag: tagColors[selectedTagForDrawing] || '#3b82f6',
          shape: { p1, p2 },
        };
        onAddAnnotation(newAnnotation);
        onSelectAnnotation(newAnnotation.id);
      }
    }

    setDrawingState({
      isDrawing: false,
      startPoint: null,
      currentPoint: null,
    });
  }, [drawingState, selectedTagForDrawing, manualAnnotations.length, onAddAnnotation, onSelectAnnotation, resizeState.isResizing, dragState.isDragging, tagColors]);

  // Calculate new shape after resize
  const calculateResizedShape = (
    originalShape: ManualAnnotation['shape'],
    handle: ResizeHandle,
    currentPoint: { x: number; y: number }
  ): ManualAnnotation['shape'] => {
    const { p1, p2 } = originalShape;
    let newP1 = { ...p1 };
    let newP2 = { ...p2 };

    switch (handle) {
      case 'nw':
        newP1 = { x: Math.min(currentPoint.x, p2.x - MIN_BOX_SIZE), y: Math.min(currentPoint.y, p2.y - MIN_BOX_SIZE) };
        break;
      case 'ne':
        newP1.y = Math.min(currentPoint.y, p2.y - MIN_BOX_SIZE);
        newP2.x = Math.max(currentPoint.x, p1.x + MIN_BOX_SIZE);
        break;
      case 'sw':
        newP1.x = Math.min(currentPoint.x, p2.x - MIN_BOX_SIZE);
        newP2.y = Math.max(currentPoint.y, p1.y + MIN_BOX_SIZE);
        break;
      case 'se':
        newP2 = { x: Math.max(currentPoint.x, p1.x + MIN_BOX_SIZE), y: Math.max(currentPoint.y, p1.y + MIN_BOX_SIZE) };
        break;
    }

    // Clamp to image bounds
    newP1.x = Math.max(0, Math.min(1, newP1.x));
    newP1.y = Math.max(0, Math.min(1, newP1.y));
    newP2.x = Math.max(0, Math.min(1, newP2.x));
    newP2.y = Math.max(0, Math.min(1, newP2.y));

    return { p1: newP1, p2: newP2 };
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedAnnotationId) {
          e.preventDefault();
          onDeleteAnnotation(selectedAnnotationId);
          onSelectAnnotation(null);
        }
      }
      if (e.key === 'Escape') {
        if (drawingState.isDrawing) {
          setDrawingState({ isDrawing: false, startPoint: null, currentPoint: null });
        } else if (dragState.isDragging) {
          setDragState({ isDragging: false, annotationId: null, startPoint: null, originalShape: null });
        } else if (selectedAnnotationId) {
          onSelectAnnotation(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnnotationId, drawingState.isDrawing, dragState.isDragging, onDeleteAnnotation, onSelectAnnotation]);

  // Deselect when clicking outside (handled by clicking empty area in SVG)
  const handleSvgClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === svgRef.current && !drawingState.isDrawing && !dragState.isDragging) {
        onSelectAnnotation(null);
      }
    },
    [drawingState.isDrawing, dragState.isDragging, onSelectAnnotation]
  );

  // Handle delete button click
  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, annotationId: string) => {
      e.stopPropagation();
      e.preventDefault();
      onDeleteAnnotation(annotationId);
      onSelectAnnotation(null);
    },
    [onDeleteAnnotation, onSelectAnnotation]
  );

  if (imageDimensions.width === 0 || imageDimensions.height === 0) {
    return null;
  }

  // Render drawing preview
  const renderDrawingPreview = () => {
    if (!drawingState.isDrawing || !drawingState.startPoint || !drawingState.currentPoint || !selectedTagForDrawing) {
      return null;
    }

    const { startPoint, currentPoint } = drawingState;
    const x = Math.min(startPoint.x, currentPoint.x) * imageDimensions.width;
    const y = Math.min(startPoint.y, currentPoint.y) * imageDimensions.height;
    const width = Math.abs(currentPoint.x - startPoint.x) * imageDimensions.width;
    const height = Math.abs(currentPoint.y - startPoint.y) * imageDimensions.height;
    const color = tagColors[selectedTagForDrawing] || '#3b82f6';

    const labelWidth = selectedTagForDrawing.length * 8 + 12;
    const labelHeight = 20;

    return (
      <g>
        {/* Preview label - above the box */}
        <rect
          x={x}
          y={y - labelHeight}
          width={labelWidth}
          height={labelHeight}
          fill={color}
          rx={2}
        />
        <text
          x={x + 6}
          y={y - labelHeight + 14}
          fill="white"
          fontSize={12}
          fontWeight="500"
          className="select-none"
        >
          {selectedTagForDrawing}
        </text>

        {/* Box outline */}
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={`${color}40`}
          stroke={color}
          strokeWidth={2}
          strokeDasharray="6 3"
        />
      </g>
    );
  };

  // Render existing AI detections (styled similar to annotations)
  const renderDetections = () => {
    return existingDetections.map((box, index) => {
      const isNormalized = box.x <= 1 && box.y <= 1 && box.width <= 1 && box.height <= 1;
      const x = isNormalized ? box.x * imageDimensions.width : box.x;
      const y = isNormalized ? box.y * imageDimensions.height : box.y;
      const width = isNormalized ? box.width * imageDimensions.width : box.width;
      const height = isNormalized ? box.height * imageDimensions.height : box.height;
      const color = box.color || '#ef4444';
      const label = box.label || 'Detection';

      return (
        <g key={`detection-${index}`} className="pointer-events-none">
          {/* Main rectangle with fill */}
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={`${color}30`}
            stroke={color}
            strokeWidth={2}
          />

          {/* Label background */}
          <rect
            x={x}
            y={y}
            width={Math.min(label.length * 7 + 16, width)}
            height={18}
            fill={color}
            rx={2}
          />

          {/* Label text */}
          <text
            x={x + 4}
            y={y + 13}
            fill="white"
            fontSize={11}
            fontWeight="500"
            className="select-none"
          >
            {label}
          </text>

          {/* Confidence badge if available */}
          {box.confidence !== undefined && (
            <>
              <rect
                x={x + width - 40}
                y={y}
                width={40}
                height={18}
                fill="rgba(0,0,0,0.6)"
                rx={2}
              />
              <text
                x={x + width - 36}
                y={y + 13}
                fill="white"
                fontSize={10}
                fontWeight="500"
                className="select-none"
              >
                {(box.confidence * 100).toFixed(0)}%
              </text>
            </>
          )}
        </g>
      );
    });
  };

  // Render manual annotations
  const renderAnnotations = () => {
    return manualAnnotations.map((annotation) => {
      const { p1, p2 } = annotation.shape;
      const x = p1.x * imageDimensions.width;
      const y = p1.y * imageDimensions.height;
      const width = (p2.x - p1.x) * imageDimensions.width;
      const height = (p2.y - p1.y) * imageDimensions.height;
      const color = tagColors[annotation.title] || '#3b82f6';
      const isSelected = annotation.id === selectedAnnotationId;

      // Delete button position (outside bottom right corner)
      const deleteButtonX = x + width + 8;
      const deleteButtonY = y + height + 8;

      // Label dimensions
      const labelWidth = annotation.title.length * 8 + 12;
      const labelHeight = 20;

      return (
        <g key={annotation.id} className={isAnnotationMode ? (isSelected ? 'cursor-move' : 'cursor-pointer') : 'pointer-events-none'}>
          {/* Label background - above the box */}
          <rect
            x={x}
            y={y - labelHeight}
            width={labelWidth}
            height={labelHeight}
            fill={color}
            rx={2}
          />

          {/* Label text */}
          <text
            x={x + 6}
            y={y - labelHeight + 14}
            fill="white"
            fontSize={12}
            fontWeight="500"
            className="select-none"
          >
            {annotation.title}
          </text>

          {/* Main rectangle with visible fill */}
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={isSelected ? `${color}50` : `${color}35`}
            stroke={color}
            strokeWidth={isSelected ? 3 : 2}
          />

          {/* Delete button (X) outside at bottom right corner - always visible in annotation mode */}
          {isAnnotationMode && (
            <g
              className="cursor-pointer"
              onMouseDown={(e) => {
                e.stopPropagation();
                handleDeleteClick(e, annotation.id);
              }}
            >
              {/* Delete button background */}
              <circle
                cx={deleteButtonX}
                cy={deleteButtonY}
                r={10}
                fill="#dc2626"
                stroke="white"
                strokeWidth={2}
              />
              {/* X icon */}
              <path
                d={`M ${deleteButtonX - 4} ${deleteButtonY - 4} L ${deleteButtonX + 4} ${deleteButtonY + 4} M ${deleteButtonX + 4} ${deleteButtonY - 4} L ${deleteButtonX - 4} ${deleteButtonY + 4}`}
                stroke="white"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </g>
          )}

          {/* Resize handles (only when selected and in annotation mode) */}
          {isSelected && isAnnotationMode && (
            <>
              {/* NW handle */}
              <circle
                cx={x}
                cy={y}
                r={7}
                fill="white"
                stroke={color}
                strokeWidth={2}
                className="cursor-nw-resize"
              />
              {/* NE handle */}
              <circle
                cx={x + width}
                cy={y}
                r={7}
                fill="white"
                stroke={color}
                strokeWidth={2}
                className="cursor-ne-resize"
              />
              {/* SW handle */}
              <circle
                cx={x}
                cy={y + height}
                r={7}
                fill="white"
                stroke={color}
                strokeWidth={2}
                className="cursor-sw-resize"
              />
              {/* SE handle */}
              <circle
                cx={x + width}
                cy={y + height}
                r={7}
                fill="white"
                stroke={color}
                strokeWidth={2}
                className="cursor-se-resize"
              />
            </>
          )}
        </g>
      );
    });
  };

  const getCursor = () => {
    if (dragState.isDragging) return 'grabbing';
    if (resizeState.isResizing) {
      switch (resizeState.handle) {
        case 'nw':
        case 'se':
          return 'nwse-resize';
        case 'ne':
        case 'sw':
          return 'nesw-resize';
      }
    }
    if (drawingState.isDrawing) return 'crosshair';
    if (isAnnotationMode && selectedTagForDrawing) return 'crosshair';
    if (isAnnotationMode && !selectedTagForDrawing) return 'default';
    return 'default';
  };

  return (
    <svg
      ref={svgRef}
      className="absolute"
      style={{
        left: `${imagePosition.left}px`,
        top: `${imagePosition.top}px`,
        width: `${imageDimensions.width}px`,
        height: `${imageDimensions.height}px`,
        cursor: getCursor(),
        pointerEvents: isAnnotationMode ? 'auto' : 'none',
      }}
      viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
      preserveAspectRatio="xMidYMid meet"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleSvgClick}
    >
      {renderDetections()}
      {renderAnnotations()}
      {renderDrawingPreview()}
    </svg>
  );
};
