'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BoundingBox, ManualAnnotation, MarkerConstants, DetectionActionState } from '@/types';
import { Tooltip } from './Tooltip';

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
  onNoTagSelected?: () => void;
  // Optional overrides (sandbox)
  markerConstants?: MarkerConstants;
  // Expandable detection markers (opt-in)
  expandableDetections?: boolean;
  detectionActions?: Map<number, DetectionActionState>;
  onDetectionAction?: (index: number, action: DetectionActionState) => void;
  onConvertToAnnotation?: (detection: BoundingBox, index: number) => void;
  onUndoConversion?: (annotation: ManualAnnotation) => void;
  availableTags?: string[];
  modelName?: string;
  modelVersion?: string;
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
  onNoTagSelected,
  markerConstants,
  expandableDetections = false,
  detectionActions,
  onDetectionAction,
  onConvertToAnnotation,
  onUndoConversion,
  availableTags = [],
  modelName,
  modelVersion,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const onUpdateAnnotationRef = useRef(onUpdateAnnotation);
  onUpdateAnnotationRef.current = onUpdateAnnotation;
  const screenToNormalizedRef = useRef<((cx: number, cy: number) => { x: number; y: number } | null) | null>(null);

  // Extra space above the image for label tabs that extend above top-edge detections
  const SVG_PAD_TOP = (markerConstants?.LABEL_HEIGHT ?? 24) + 4;

  const [expandedDetectionIndex, setExpandedDetectionIndex] = useState<number | null>(null);
  const [showRejectOptions, setShowRejectOptions] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
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

      // SVG extends SVG_PAD_TOP above the image, so subtract to get image-relative Y
      return {
        x: Math.max(0, Math.min(1, relX / imageDimensions.width)),
        y: Math.max(0, Math.min(1, (relY - SVG_PAD_TOP) / imageDimensions.height)),
      };
    },
    [imageDimensions, zoom, SVG_PAD_TOP]
  );
  screenToNormalizedRef.current = screenToNormalized;

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

  // Core pointer-down logic (shared between mouse and touch)
  const handlePointerDown = useCallback(
    (clientX: number, clientY: number) => {
      if (!isAnnotationMode) return;

      const point = screenToNormalized(clientX, clientY);
      if (!point) return;

      // Check if clicking on a resize handle first (only for selected annotation)
      if (selectedAnnotationId) {
        const annotation = manualAnnotations.find((a) => a.id === selectedAnnotationId);
        if (annotation) {
          const handle = getClickedHandle(point, annotation.shape);
          if (handle) {
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
        if (clickedAnnotation.id === selectedAnnotationId) {
          setDragState({
            isDragging: true,
            annotationId: clickedAnnotation.id,
            startPoint: point,
            originalShape: { ...clickedAnnotation.shape },
          });
        } else {
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
      } else {
        onNoTagSelected?.();
      }
    },
    [isAnnotationMode, selectedTagForDrawing, selectedAnnotationId, manualAnnotations, screenToNormalized, onSelectAnnotation, onNoTagSelected]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => handlePointerDown(e.clientX, e.clientY),
    [handlePointerDown]
  );

  // Core pointer-move logic (shared between mouse and touch)
  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      const point = screenToNormalized(clientX, clientY);
      if (!point) return;

      // Handle dragging
      if (dragState.isDragging && dragState.originalShape && dragState.annotationId && dragState.startPoint) {
        const deltaX = point.x - dragState.startPoint.x;
        const deltaY = point.y - dragState.startPoint.y;

        const { p1, p2 } = dragState.originalShape;
        const boxWidth = p2.x - p1.x;
        const boxHeight = p2.y - p1.y;

        let newP1X = p1.x + deltaX;
        let newP1Y = p1.y + deltaY;

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

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => handlePointerMove(e.clientX, e.clientY),
    [handlePointerMove]
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

  // Touch wrappers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
    },
    [handlePointerDown]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    },
    [handlePointerMove]
  );

  const handleTouchEnd = useCallback(() => {
    handleMouseUp();
  }, [handleMouseUp]);

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
        if (expandedDetectionIndex !== null) {
          setExpandedDetectionIndex(null);
          setShowRejectOptions(false);
          setShowTagPicker(false);
          return;
        }
        if (drawingState.isDrawing) {
          setDrawingState({ isDrawing: false, startPoint: null, currentPoint: null });
        } else if (resizeState.isResizing) {
          setResizeState({ isResizing: false, handle: null, annotationId: null, startPoint: null, originalShape: null });
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

  // Window-level drag listeners (so dragging works even when SVG has pointer-events:none)
  useEffect(() => {
    if (!dragState.isDragging) return;

    const { originalShape, annotationId, startPoint } = dragState;
    if (!originalShape || !annotationId || !startPoint) return;

    const applyDrag = (clientX: number, clientY: number) => {
      const point = screenToNormalizedRef.current?.(clientX, clientY);
      if (!point) return;

      const deltaX = point.x - startPoint.x;
      const deltaY = point.y - startPoint.y;
      const { p1, p2 } = originalShape;
      const boxWidth = p2.x - p1.x;
      const boxHeight = p2.y - p1.y;

      const newP1X = Math.max(0, Math.min(1 - boxWidth, p1.x + deltaX));
      const newP1Y = Math.max(0, Math.min(1 - boxHeight, p1.y + deltaY));

      onUpdateAnnotationRef.current(annotationId, {
        shape: { p1: { x: newP1X, y: newP1Y }, p2: { x: newP1X + boxWidth, y: newP1Y + boxHeight } },
      });
    };

    const onMove = (e: MouseEvent) => { e.preventDefault(); applyDrag(e.clientX, e.clientY); };
    const onTouchMove = (e: TouchEvent) => { if (e.touches.length === 1) { e.preventDefault(); applyDrag(e.touches[0].clientX, e.touches[0].clientY); } };

    const onUp = () => {
      setDragState({ isDragging: false, annotationId: null, startPoint: null, originalShape: null });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragState.isDragging, dragState.originalShape, dragState.annotationId, dragState.startPoint]);

  // Window-level resize listeners (so resizing works even when SVG has pointer-events:none)
  useEffect(() => {
    if (!resizeState.isResizing) return;

    const { handle, originalShape, annotationId } = resizeState;
    if (!handle || !originalShape || !annotationId) return;

    const applyResize = (clientX: number, clientY: number) => {
      const point = screenToNormalizedRef.current?.(clientX, clientY);
      if (!point) return;
      const newShape = calculateResizedShape(originalShape, handle, point);
      onUpdateAnnotationRef.current(annotationId, { shape: newShape });
    };

    const onMove = (e: MouseEvent) => { e.preventDefault(); applyResize(e.clientX, e.clientY); };
    const onTouchMove = (e: TouchEvent) => { if (e.touches.length === 1) { e.preventDefault(); applyResize(e.touches[0].clientX, e.touches[0].clientY); } };

    const onUp = () => {
      setResizeState({ isResizing: false, handle: null, annotationId: null, startPoint: null, originalShape: null });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [resizeState.isResizing, resizeState.handle, resizeState.originalShape, resizeState.annotationId]);

  // Deselect when clicking outside (handled by clicking empty area in SVG)
  const handleSvgClick = useCallback(
    () => {
      if (!drawingState.isDrawing && !dragState.isDragging && !resizeState.isResizing) {
        onSelectAnnotation(null);
      }
    },
    [drawingState.isDrawing, dragState.isDragging, resizeState.isResizing, onSelectAnnotation]
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

  // Shared label tab constants (overridable via markerConstants prop)
  const LABEL_HEIGHT = markerConstants?.LABEL_HEIGHT ?? 24;
  const LABEL_FONT_SIZE = markerConstants?.LABEL_FONT_SIZE ?? 13;
  const LABEL_CHAR_WIDTH = markerConstants?.LABEL_CHAR_WIDTH ?? 8;
  const LABEL_PADDING = markerConstants?.LABEL_PADDING ?? 10;
  const ACTION_BTN_SIZE = markerConstants?.ACTION_BTN_SIZE ?? 22;
  const DETECTION_LABEL_RADIUS = markerConstants?.DETECTION_LABEL_RADIUS ?? 4;
  const ANNOTATION_LABEL_RADIUS = markerConstants?.ANNOTATION_LABEL_RADIUS ?? 4;
  const LABEL_CENTER = LABEL_HEIGHT / 2;
  const LABEL_TEXT_Y = LABEL_CENTER + Math.round(LABEL_FONT_SIZE * 0.35);

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
    const labelWidth = selectedTagForDrawing.length * LABEL_CHAR_WIDTH + LABEL_PADDING * 2;

    return (
      <g>
        {/* Preview label tab - above the box */}
        <rect
          x={x}
          y={y - LABEL_HEIGHT}
          width={labelWidth}
          height={LABEL_HEIGHT}
          fill={color}
          rx={DETECTION_LABEL_RADIUS}
        />
        <text
          x={x + LABEL_PADDING}
          y={y - LABEL_HEIGHT + LABEL_TEXT_Y}
          fill="white"
          fontSize={LABEL_FONT_SIZE}
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
          fill={`${color}30`}
          stroke={color}
          strokeWidth={2}
          strokeDasharray="6 3"
        />
      </g>
    );
  };

  // Build set of detection indices that have been converted to annotations
  const convertedDetectionIndices = new Set(
    manualAnnotations
      .filter((a) => a.convertedFromDetectionIndex !== undefined)
      .map((a) => a.convertedFromDetectionIndex!)
  );

  // Render existing AI detections
  const renderDetections = () => {
    return existingDetections.map((box, index) => {
      // Hide detections that have been converted to annotations
      if (convertedDetectionIndices.has(index)) return null;
      const isNormalized = box.x <= 1 && box.y <= 1 && box.width <= 1 && box.height <= 1;
      const x = isNormalized ? box.x * imageDimensions.width : box.x;
      const y = isNormalized ? box.y * imageDimensions.height : box.y;
      const width = isNormalized ? box.width * imageDimensions.width : box.width;
      const height = isNormalized ? box.height * imageDimensions.height : box.height;

      // Action state (accepted/rejected/reclassified)
      const actionState = detectionActions?.get(index);
      const effectiveLabel = actionState?.reclassifiedTo || box.label || 'Detection';
      const effectiveColor = actionState?.reclassifiedTo
        ? (tagColors[actionState.reclassifiedTo] || box.color || '#ef4444')
        : (box.color || '#ef4444');

      const hasConfidence = box.confidence !== undefined;
      const isExpanded = expandableDetections && expandedDetectionIndex === index;
      const isRejected = actionState?.status === 'rejected';
      const isAccepted = actionState?.status === 'accepted';

      // Label tab dimensions (includes "AI" badge prefix space: 6px pad + 17px badge + 5px gap)
      const AI_BADGE_WIDTH = 19;
      const labelTextWidth = effectiveLabel.length * LABEL_CHAR_WIDTH + LABEL_PADDING * 2 + AI_BADGE_WIDTH;
      const hasActionBtn = expandableDetections || hasConfidence;
      const labelWidth = labelTextWidth + (hasActionBtn ? ACTION_BTN_SIZE : 0);
      const btnCx = x + labelTextWidth + ACTION_BTN_SIZE / 2;
      const btnCy = y - LABEL_HEIGHT + LABEL_CENTER;

      // Status color overrides — accepted keeps original color, only AI badge turns green
      const boxColor = effectiveColor;
      const boxFill = isRejected ? `${boxColor}10` : `${boxColor}30`;
      const boxStroke = boxColor;

      return (
        <g
          key={`detection-${index}`}
          className={expandableDetections ? 'cursor-pointer' : 'pointer-events-none'}
          style={{ opacity: isRejected ? 0.35 : 1 }}
        >
          {/* Main rectangle — square top-left, rounded other corners (hidden when expanded) */}
          {!isExpanded && (
            <path
              d={`M ${x} ${y} H ${x + width - DETECTION_LABEL_RADIUS} Q ${x + width} ${y} ${x + width} ${y + DETECTION_LABEL_RADIUS} V ${y + height - DETECTION_LABEL_RADIUS} Q ${x + width} ${y + height} ${x + width - DETECTION_LABEL_RADIUS} ${y + height} H ${x + DETECTION_LABEL_RADIUS} Q ${x} ${y + height} ${x} ${y + height - DETECTION_LABEL_RADIUS} V ${y} Z`}
              fill={boxFill}
              stroke={boxStroke}
              strokeWidth={2}
              strokeDasharray={isRejected ? '6 3' : undefined}
              className={expandableDetections ? 'pointer-events-auto' : undefined}
              onClick={expandableDetections ? () => {
                setExpandedDetectionIndex((prev) => prev === index ? null : index);
                setShowRejectOptions(false);
                setShowTagPicker(false);
              } : undefined}
            />
          )}

          {/* Label tab — solid fill, top-rounded; bottom-right rounded only when label overhangs box */}
          <path
            d={labelWidth > width
              ? `M ${x} ${y} V ${y - LABEL_HEIGHT + DETECTION_LABEL_RADIUS} Q ${x} ${y - LABEL_HEIGHT} ${x + DETECTION_LABEL_RADIUS} ${y - LABEL_HEIGHT} H ${x + labelWidth - DETECTION_LABEL_RADIUS} Q ${x + labelWidth} ${y - LABEL_HEIGHT} ${x + labelWidth} ${y - LABEL_HEIGHT + DETECTION_LABEL_RADIUS} V ${y - DETECTION_LABEL_RADIUS} Q ${x + labelWidth} ${y} ${x + labelWidth - DETECTION_LABEL_RADIUS} ${y} Z`
              : `M ${x} ${y} V ${y - LABEL_HEIGHT + DETECTION_LABEL_RADIUS} Q ${x} ${y - LABEL_HEIGHT} ${x + DETECTION_LABEL_RADIUS} ${y - LABEL_HEIGHT} H ${x + labelWidth - DETECTION_LABEL_RADIUS} Q ${x + labelWidth} ${y - LABEL_HEIGHT} ${x + labelWidth} ${y - LABEL_HEIGHT + DETECTION_LABEL_RADIUS} V ${y} Z`}
            fill={boxColor}
            stroke={boxColor}
            strokeWidth={2}
            className={expandableDetections ? 'pointer-events-auto cursor-pointer' : undefined}
            onClick={expandableDetections ? () => {
              setExpandedDetectionIndex((prev) => prev === index ? null : index);
              setShowTagPicker(false);
            } : undefined}
          />

          {/* Type indicator: "AI" badge — turns green when accepted */}
          <g>
            <rect
              x={x + 6}
              y={y - LABEL_HEIGHT + 6}
              width={17}
              height={LABEL_HEIGHT - 12}
              rx={3}
              fill={isAccepted ? '#22c55e' : 'white'}
            />
            <text
              x={x + 14.5}
              y={y - LABEL_HEIGHT + LABEL_CENTER}
              fill={isAccepted ? 'white' : boxColor}
              fontSize={Math.max(8, LABEL_FONT_SIZE - 3)}
              fontWeight="700"
              textAnchor="middle"
              dominantBaseline="central"
              className="select-none"
            >
              AI
            </text>
          </g>

          <text
            x={x + LABEL_PADDING + 19}
            y={y - LABEL_HEIGHT + LABEL_CENTER}
            fill="white"
            fontSize={LABEL_FONT_SIZE}
            fontWeight="500"
            dominantBaseline="central"
            className="select-none"
            textDecoration={isRejected ? 'line-through' : undefined}
          >
            {effectiveLabel}
          </text>

          {/* Action button area in label tab */}
          {expandableDetections ? (
            // Chevron expand/collapse
            <g
              className="cursor-pointer pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedDetectionIndex((prev) => prev === index ? null : index);
                setShowRejectOptions(false);
                setShowTagPicker(false);
              }}
            >
              {/* Invisible larger hit area */}
              <circle cx={btnCx} cy={btnCy} r={ACTION_BTN_SIZE / 2} fill="transparent" />
              <path
                d={isExpanded
                  ? `M ${btnCx - 4} ${btnCy + 2} L ${btnCx} ${btnCy - 2} L ${btnCx + 4} ${btnCy + 2}`
                  : `M ${btnCx - 4} ${btnCy - 2} L ${btnCx} ${btnCy + 2} L ${btnCx + 4} ${btnCy - 2}`
                }
                stroke="white"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </g>
          ) : (
            // Default: confidence "i" tooltip
            hasConfidence && (
              <foreignObject
                x={btnCx - ACTION_BTN_SIZE / 2}
                y={btnCy - ACTION_BTN_SIZE / 2}
                width={ACTION_BTN_SIZE}
                height={ACTION_BTN_SIZE}
                className="pointer-events-auto overflow-visible"
              >
                <Tooltip content={`Confidence Score: ${(box.confidence! * 100).toFixed(1)}%`} position="top">
                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white cursor-default select-none">
                    i
                  </div>
                </Tooltip>
              </foreignObject>
            )
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
      const showDelete = true;
      const isConverted = annotation.convertedFromDetectionIndex !== undefined && !!onUndoConversion;
      const ICON_WIDTH = isConverted ? 19 : 12; // AI badge is wider than pencil icon
      const labelTextWidth = annotation.title.length * LABEL_CHAR_WIDTH + LABEL_PADDING * 2 + ICON_WIDTH;
      const actionBtns = (showDelete ? 1 : 0) + (isConverted ? 1 : 0);
      const labelWidth = labelTextWidth + actionBtns * ACTION_BTN_SIZE;
      const undoBtnCx = x + labelTextWidth + ACTION_BTN_SIZE / 2;
      const btnCx = x + labelTextWidth + (isConverted ? ACTION_BTN_SIZE : 0) + ACTION_BTN_SIZE / 2;
      const btnCy = y - LABEL_HEIGHT + LABEL_CENTER;

      // Core drag/resize logic from coordinates (shared between mouse and touch)
      const startDragFromCoords = (clientX: number, clientY: number) => {
        const point = screenToNormalized(clientX, clientY);
        if (!point) return;

        // If selected and pointer is on a resize handle, start resize instead
        if (isSelected) {
          const handle = getClickedHandle(point, annotation.shape);
          if (handle) {
            setResizeState({
              isResizing: true,
              handle,
              annotationId: annotation.id,
              startPoint: point,
              originalShape: { p1: { ...annotation.shape.p1 }, p2: { ...annotation.shape.p2 } },
            });
            return;
          }
        }

        onSelectAnnotation(annotation.id);
        setDragState({
          isDragging: true,
          annotationId: annotation.id,
          startPoint: point,
          originalShape: { p1: { ...annotation.shape.p1 }, p2: { ...annotation.shape.p2 } },
        });
      };

      const startDrag = (e: React.MouseEvent) => {
        e.stopPropagation();
        startDragFromCoords(e.clientX, e.clientY);
      };

      const startDragTouch = (e: React.TouchEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (e.touches.length === 1) {
          startDragFromCoords(e.touches[0].clientX, e.touches[0].clientY);
        }
      };

      const isDraggingThis = dragState.isDragging && dragState.annotationId === annotation.id;

      return (
        <g key={annotation.id} className="cursor-grab" onClick={(e) => e.stopPropagation()}>
          {/* Main rectangle — square top-left, rounded other corners */}
          <path
            d={`M ${x} ${y} H ${x + width - ANNOTATION_LABEL_RADIUS} Q ${x + width} ${y} ${x + width} ${y + ANNOTATION_LABEL_RADIUS} V ${y + height - ANNOTATION_LABEL_RADIUS} Q ${x + width} ${y + height} ${x + width - ANNOTATION_LABEL_RADIUS} ${y + height} H ${x + ANNOTATION_LABEL_RADIUS} Q ${x} ${y + height} ${x} ${y + height - ANNOTATION_LABEL_RADIUS} V ${y} Z`}
            fill={isSelected ? `${color}50` : `${color}15`}
            stroke={color}
            strokeWidth={isSelected ? 3 : 2}
            strokeDasharray="3 6"
            strokeLinecap="round"
            className={`pointer-events-auto cursor-grab${isSelected || isDraggingThis ? ' annotation-border-animated' : ''}`}
            onMouseDown={startDrag}
            onTouchStart={startDragTouch}
          />

          {/* Label tab — outlined for manual, semi-solid for converted (top-rounded); bottom-right rounded only when label overhangs box */}
          <path
            d={labelWidth > width
              ? `M ${x} ${y} V ${y - LABEL_HEIGHT + ANNOTATION_LABEL_RADIUS} Q ${x} ${y - LABEL_HEIGHT} ${x + ANNOTATION_LABEL_RADIUS} ${y - LABEL_HEIGHT} H ${x + labelWidth - ANNOTATION_LABEL_RADIUS} Q ${x + labelWidth} ${y - LABEL_HEIGHT} ${x + labelWidth} ${y - LABEL_HEIGHT + ANNOTATION_LABEL_RADIUS} V ${y - ANNOTATION_LABEL_RADIUS} Q ${x + labelWidth} ${y} ${x + labelWidth - ANNOTATION_LABEL_RADIUS} ${y} Z`
              : `M ${x} ${y} V ${y - LABEL_HEIGHT + ANNOTATION_LABEL_RADIUS} Q ${x} ${y - LABEL_HEIGHT} ${x + ANNOTATION_LABEL_RADIUS} ${y - LABEL_HEIGHT} H ${x + labelWidth - ANNOTATION_LABEL_RADIUS} Q ${x + labelWidth} ${y - LABEL_HEIGHT} ${x + labelWidth} ${y - LABEL_HEIGHT + ANNOTATION_LABEL_RADIUS} V ${y} Z`}
            fill={isConverted ? `${color}50` : `${color}20`}
            stroke={color}
            strokeWidth={isSelected ? 3 : 2}
            className="pointer-events-auto cursor-grab"
            onMouseDown={startDrag}
            onTouchStart={startDragTouch}
          />

          {/* Type icon: AI badge for converted, pencil for user-drawn */}
          {isConverted ? (
            <g>
              <rect
                x={x + 6}
                y={y - LABEL_HEIGHT + 6}
                width={17}
                height={LABEL_HEIGHT - 12}
                rx={3}
                fill="white"
                opacity={0.85}
              />
              <text
                x={x + 14.5}
                y={y - LABEL_HEIGHT + LABEL_CENTER}
                fill={color}
                fontSize={Math.max(8, LABEL_FONT_SIZE - 3)}
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="central"
                className="select-none"
              >
                AI
              </text>
            </g>
          ) : (
            <path
              d={`M ${x + 9} ${btnCy} L ${x + 13} ${btnCy - 4} L ${x + 15} ${btnCy - 2} L ${x + 11} ${btnCy + 2} Z M ${x + 9} ${btnCy} L ${x + 7} ${btnCy + 4} L ${x + 11} ${btnCy + 2}`}
              fill="none"
              stroke="white"
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          <text
            x={x + LABEL_PADDING + ICON_WIDTH}
            y={y - LABEL_HEIGHT + LABEL_CENTER}
            fill="white"
            fontSize={LABEL_FONT_SIZE}
            fontWeight="600"
            dominantBaseline="central"
            className="select-none"
          >
            {annotation.title}
          </text>

          {/* Undo conversion circular arrow (for annotations converted from detections) */}
          {isConverted && (
            <g
              className="cursor-pointer pointer-events-auto"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onUndoConversion!(annotation);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onUndoConversion!(annotation);
              }}
            >
              {/* Invisible larger hit area */}
              <circle cx={undoBtnCx} cy={btnCy} r={ACTION_BTN_SIZE / 2} fill="transparent" />
              {/* Undo icon (matches sidebar) */}
              <svg x={undoBtnCx - 6} y={btnCy - 6} width={12} height={12} viewBox="0 0 16 16" fill="none">
                <path d="M8.5 3A5 5 0 1 1 4.5 12" stroke="#f59e0b" strokeWidth={1.8} strokeLinecap="round" fill="none" />
                <path d="M6 1L8.5 3L6 5" stroke="#f59e0b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </g>
          )}

          {/* Delete "X" button inline in label tab */}
          {showDelete && (
            <g
              className="cursor-pointer pointer-events-auto"
              onMouseDown={(e) => {
                e.stopPropagation();
                handleDeleteClick(e, annotation.id);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDeleteAnnotation(annotation.id);
                onSelectAnnotation(null);
              }}
            >
              {/* Invisible larger hit area */}
              <circle cx={btnCx} cy={btnCy} r={ACTION_BTN_SIZE / 2} fill="transparent" />
              <path
                d={`M ${btnCx - 4} ${btnCy - 4} L ${btnCx + 4} ${btnCy + 4} M ${btnCx + 4} ${btnCy - 4} L ${btnCx - 4} ${btnCy + 4}`}
                stroke="#ef4444"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </g>
          )}

          {/* Resize handles (always visible when selected) */}
          {isSelected && (
            <>
              {([
                { handle: 'nw' as ResizeHandle, cx: x, cy: y },
                { handle: 'ne' as ResizeHandle, cx: x + width, cy: y },
                { handle: 'sw' as ResizeHandle, cx: x, cy: y + height },
                { handle: 'se' as ResizeHandle, cx: x + width, cy: y + height },
              ]).map(({ handle, cx, cy }) => (
                <g key={handle}
                  className="pointer-events-auto"
                  style={{ cursor: handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const point = screenToNormalized(e.clientX, e.clientY);
                    if (point) {
                      setResizeState({
                        isResizing: true,
                        handle,
                        annotationId: annotation.id,
                        startPoint: point,
                        originalShape: { p1: { ...annotation.shape.p1 }, p2: { ...annotation.shape.p2 } },
                      });
                    }
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (e.touches.length === 1) {
                      const point = screenToNormalized(e.touches[0].clientX, e.touches[0].clientY);
                      if (point) {
                        setResizeState({
                          isResizing: true,
                          handle,
                          annotationId: annotation.id,
                          startPoint: point,
                          originalShape: { p1: { ...annotation.shape.p1 }, p2: { ...annotation.shape.p2 } },
                        });
                      }
                    }
                  }}
                >
                  {/* Invisible larger hit area */}
                  <circle cx={cx} cy={cy} r={10} fill="transparent" />
                  {/* Visible handle dot */}
                  <circle cx={cx} cy={cy} r={4} fill="white" stroke={color} strokeWidth={1.5} />
                </g>
              ))}
            </>
          )}
        </g>
      );
    });
  };

  // Render expanded detection panel as a top-level overlay (above all markers in z-order)
  const renderExpandedDetectionPanel = () => {
    if (expandedDetectionIndex === null || !expandableDetections) return null;

    const box = existingDetections[expandedDetectionIndex];
    if (!box) return null;

    const svg = svgRef.current;
    if (!svg) return null;

    const index = expandedDetectionIndex;
    const isNormalized = box.x <= 1 && box.y <= 1 && box.width <= 1 && box.height <= 1;
    const svgX = isNormalized ? box.x * imageDimensions.width : box.x;
    const svgY = isNormalized ? box.y * imageDimensions.height : box.y;

    const actionState = detectionActions?.get(index);
    const effectiveLabel = actionState?.reclassifiedTo || box.label || 'Detection';
    const effectiveColor = actionState?.reclassifiedTo
      ? (tagColors[actionState.reclassifiedTo] || box.color || '#ef4444')
      : (box.color || '#ef4444');

    const hasConfidence = box.confidence !== undefined;
    const isRejected = actionState?.status === 'rejected';
    const isAccepted = actionState?.status === 'accepted';

    const AI_BADGE_WIDTH = 16;
    const labelTextWidth = effectiveLabel.length * LABEL_CHAR_WIDTH + LABEL_PADDING * 2 + AI_BADGE_WIDTH;
    const hasActionBtn = expandableDetections || hasConfidence;
    const labelWidth = labelTextWidth + (hasActionBtn ? ACTION_BTN_SIZE : 0);

    const boxColor = isAccepted ? '#22c55e' : effectiveColor;
    const panelWidth = Math.max(280, labelWidth);
    const basePanelHeight = 240;
    const rejectExtra = showRejectOptions ? 50 : 0;
    const tagPickerExtra = showTagPicker && showRejectOptions ? 100 : 0;
    const panelHeight = basePanelHeight + rejectExtra + tagPickerExtra;

    // Convert SVG coordinates to screen coordinates using the SVG's bounding rect
    const svgRect = svg.getBoundingClientRect();
    const viewBoxWidth = imageDimensions.width;
    const viewBoxHeight = imageDimensions.height + SVG_PAD_TOP;

    let screenX = svgRect.left + (svgX / viewBoxWidth) * svgRect.width;
    let screenY = svgRect.top + ((svgY + SVG_PAD_TOP) / viewBoxHeight) * svgRect.height;

    // Smart positioning: keep panel within viewport
    if (screenX + panelWidth > window.innerWidth - 10) {
      screenX = Math.max(10, window.innerWidth - panelWidth - 10);
    }
    if (screenY + panelHeight > window.innerHeight - 10) {
      screenY = Math.max(10, window.innerHeight - panelHeight - 10);
    }

    return createPortal(
      <div
        className="animate-fade-in"
        style={{
          position: 'fixed',
          left: screenX - 1,
          top: screenY,
          width: panelWidth + 2,
          zIndex: 300,
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(13, 17, 28, 0.96)',
            border: `2px solid ${boxColor}`,
            borderRadius: '0 3px 3px 3px',
            padding: '10px 12px',
            backdropFilter: 'blur(12px)',
            fontSize: 11,
            fontFamily: 'Inter, system-ui, sans-serif',
            position: 'relative',
          }}
        >
          {/* Close button */}
          <button
            onClick={(e) => { e.stopPropagation(); setExpandedDetectionIndex(null); setShowRejectOptions(false); setShowTagPicker(false); }}
            style={{
              position: 'absolute', top: 6, right: 6,
              width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6b7280', padding: 0, lineHeight: 1,
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#ffffff'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#6b7280'; }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 1L9 9M9 1L1 9" />
            </svg>
          </button>

          {/* Header: AI Detection label */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{
                fontSize: 8, fontWeight: 700, color: 'rgb(13, 17, 28)',
                backgroundColor: 'white', padding: '2px 5px',
                borderRadius: 3, letterSpacing: '0.05em', lineHeight: 1,
              }}>AI Detection</span>
              <span style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 12, lineHeight: 1 }}>{effectiveLabel}</span>
            </div>
            {actionState?.reclassifiedTo && (
              <span style={{ fontSize: 9, color: '#6b7280' }}>was: {actionState.originalLabel}</span>
            )}
          </div>

          {/* Model & Version */}
          {(modelName || modelVersion) && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              {modelName && (
                <div>
                  <span style={{ fontSize: 9, color: '#6b7280', display: 'block', marginBottom: 2 }}>Model</span>
                  <span style={{ fontSize: 11, color: '#d1d5db', fontWeight: 500 }}>{modelName}</span>
                </div>
              )}
              {modelVersion && (
                <div>
                  <span style={{ fontSize: 9, color: '#6b7280', display: 'block', marginBottom: 2 }}>Version</span>
                  <span style={{ fontSize: 11, color: '#d1d5db', fontWeight: 500 }}>{modelVersion}</span>
                </div>
              )}
            </div>
          )}

          {/* Confidence bar */}
          {hasConfidence && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: '#6b7280' }}>Confidence</span>
                <span style={{ fontSize: 10, color: 'white', fontWeight: 600 }}>
                  {((box.confidence ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{
                height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${(box.confidence ?? 0) * 100}%`,
                  backgroundColor: (box.confidence ?? 0) > 0.8 ? '#22c55e' : (box.confidence ?? 0) > 0.5 ? '#f59e0b' : '#ef4444',
                }} />
              </div>
            </div>
          )}

          {/* Accept / Reject row */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <button
              onClick={() => {
                onDetectionAction?.(index, { status: 'accepted' });
                setExpandedDetectionIndex(null);
                setShowRejectOptions(false);
                setShowTagPicker(false);
              }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '6px 0', borderRadius: 6,
                border: isAccepted ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                backgroundColor: isAccepted ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.03)',
                color: isAccepted ? '#22c55e' : '#9ca3af',
                fontSize: 11, fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 10v12"/><path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/>
              </svg>
              Accept
            </button>
            <button
              onClick={() => {
                setShowRejectOptions((prev) => !prev);
                setShowTagPicker(false);
              }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '6px 0', borderRadius: 6,
                border: (isRejected || showRejectOptions) ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                backgroundColor: (isRejected || showRejectOptions) ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)',
                color: (isRejected || showRejectOptions) ? '#ef4444' : '#9ca3af',
                fontSize: 11, fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 14V2"/><path d="M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/>
              </svg>
              Reject
            </button>
          </div>

          {/* Reject reason sub-options */}
          {showRejectOptions && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 4, letterSpacing: '0.03em' }}>What&apos;s wrong?</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => {
                    onDetectionAction?.(index, { status: 'rejected', rejectionReason: 'false_positive' });
                    setExpandedDetectionIndex(null);
                    setShowRejectOptions(false);
                  }}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    padding: '5px 0', borderRadius: 6,
                    border: actionState?.rejectionReason === 'false_positive' ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: actionState?.rejectionReason === 'false_positive' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.03)',
                    color: actionState?.rejectionReason === 'false_positive' ? '#ef4444' : '#9ca3af',
                    fontSize: 10, fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                  Nothing Here
                </button>
                <button
                  onClick={() => {
                    setShowTagPicker((prev) => !prev);
                  }}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    padding: '5px 0', borderRadius: 6,
                    border: showTagPicker ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: showTagPicker ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                    color: showTagPicker ? '#60a5fa' : '#9ca3af',
                    fontSize: 10, fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                  </svg>
                  Wrong Label
                </button>
              </div>
            </div>
          )}

          {/* Tag picker (shown when "Wrong Label" is selected) */}
          {showTagPicker && showRejectOptions && (
            <div style={{
              maxHeight: 80, overflowY: 'auto', marginBottom: 4,
              backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 4,
              position: 'relative', zIndex: 10,
            }}>
              {availableTags.filter((t) => t !== effectiveLabel).map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    onDetectionAction?.(index, {
                      status: 'rejected',
                      rejectionReason: 'wrong_label',
                      originalLabel: actionState?.originalLabel || box.label,
                      reclassifiedTo: tag,
                    });
                    setExpandedDetectionIndex(null);
                    setShowTagPicker(false);
                    setShowRejectOptions(false);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    width: '100%', textAlign: 'left', padding: '4px 6px',
                    borderRadius: 4, border: 'none',
                    backgroundColor: 'transparent',
                    color: tagColors[tag] || '#d1d5db',
                    fontSize: 11, cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                    backgroundColor: tagColors[tag] || '#6b7280',
                  }} />
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Convert to Annotation */}
          {onConvertToAnnotation && (
            <button
              onClick={() => {
                onConvertToAnnotation(box, index);
                setExpandedDetectionIndex(null);
                setShowRejectOptions(false);
                setShowTagPicker(false);
              }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '5px 0', borderRadius: 6, marginTop: 6,
                border: '1px solid rgba(255,255,255,0.1)',
                backgroundColor: 'rgba(255,255,255,0.03)',
                color: '#9ca3af', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              </svg>
              Convert to Annotation
            </button>
          )}
        </div>
      </div>,
      document.body
    );
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
    <>
      <svg
        ref={svgRef}
        className="absolute"
        style={{
          left: `${imagePosition.left}px`,
          top: `${imagePosition.top - SVG_PAD_TOP}px`,
          width: `${imageDimensions.width}px`,
          height: `${imageDimensions.height + SVG_PAD_TOP}px`,
          overflow: 'visible',
          cursor: getCursor(),
          pointerEvents: isAnnotationMode || selectedAnnotationId ? 'auto' : 'none',
          touchAction: isAnnotationMode || selectedAnnotationId ? 'none' : 'auto',
        }}
        viewBox={`0 ${-SVG_PAD_TOP} ${imageDimensions.width} ${imageDimensions.height + SVG_PAD_TOP}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (!dragState.isDragging && !resizeState.isResizing) {
            handleMouseUp();
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleSvgClick}
      >
        {/* Invisible hit area so clicks on empty space register */}
        <rect width={imageDimensions.width} height={imageDimensions.height} fill="transparent" />
        {renderDetections()}
        {renderAnnotations()}
        {renderDrawingPreview()}
      </svg>
      {renderExpandedDetectionPanel()}
    </>
  );
};
