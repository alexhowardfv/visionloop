'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ImageReviewModalProps, ManualAnnotation, DetectionActionState, BoundingBox } from '@/types';
import { ImageWithBoundingBoxes } from './ImageWithBoundingBoxes';
import { AnnotationLayer } from './AnnotationLayer';
import { Tooltip } from './Tooltip';

// Recursive JSON tree viewer with collapsible nodes and color-coded values
const JsonTree: React.FC<{ data: unknown; level?: number; defaultExpanded?: boolean; keyName?: string }> = ({
  data,
  level = 0,
  defaultExpanded = true,
  keyName,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const indent = level * 16;

  // Render a primitive value with color coding
  const renderValue = (val: unknown) => {
    if (val === null || val === undefined) {
      return <span className="text-red-400 italic">null</span>;
    }
    if (typeof val === 'boolean') {
      return <span className="text-yellow-400">{String(val)}</span>;
    }
    if (typeof val === 'number') {
      return <span className="text-blue-400">{val}</span>;
    }
    if (typeof val === 'string') {
      return <span className="text-green-400">&quot;{val}&quot;</span>;
    }
    return <span className="text-text-secondary">{String(val)}</span>;
  };

  // Primitive
  if (data === null || data === undefined || typeof data !== 'object') {
    return (
      <div style={{ paddingLeft: indent }} className="py-0.5 font-mono text-xs leading-relaxed">
        {keyName !== undefined && (
          <><span className="text-purple-400">&quot;{keyName}&quot;</span><span className="text-text-muted">: </span></>
        )}
        {renderValue(data)}
      </div>
    );
  }

  const isArray = Array.isArray(data);
  const entries = isArray ? (data as unknown[]).map((v, i) => [String(i), v] as const) : Object.entries(data as Record<string, unknown>);
  const isEmpty = entries.length === 0;
  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';

  if (isEmpty) {
    return (
      <div style={{ paddingLeft: indent }} className="py-0.5 font-mono text-xs leading-relaxed">
        {keyName !== undefined && (
          <><span className="text-purple-400">&quot;{keyName}&quot;</span><span className="text-text-muted">: </span></>
        )}
        <span className="text-text-muted">{openBracket}{closeBracket}</span>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{ paddingLeft: indent }}
        className="py-0.5 font-mono text-xs leading-relaxed cursor-pointer hover:bg-white/5 rounded select-none flex items-center gap-1"
        onClick={() => setExpanded(!expanded)}
      >
        <svg
          className={`w-3 h-3 text-text-muted flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M6 4l8 6-8 6V4z" />
        </svg>
        {keyName !== undefined && (
          <><span className="text-purple-400">&quot;{keyName}&quot;</span><span className="text-text-muted">: </span></>
        )}
        <span className="text-text-muted">{openBracket}</span>
        {!expanded && (
          <span className="text-text-muted ml-1">
            ...{entries.length} {isArray ? 'items' : 'keys'} {closeBracket}
          </span>
        )}
      </div>
      {expanded && (
        <>
          {entries.map(([key, value]) => (
            <JsonTree
              key={key}
              data={value}
              level={level + 1}
              defaultExpanded={level < 1}
              keyName={isArray ? undefined : key}
            />
          ))}
          <div style={{ paddingLeft: indent }} className="py-0.5 font-mono text-xs leading-relaxed">
            <span className="text-text-muted ml-4">{closeBracket}</span>
          </div>
        </>
      )}
    </div>
  );
};

export const ImageReviewModal: React.FC<ImageReviewModalProps> = ({
  isOpen,
  selectedImages,
  currentIndex,
  onClose,
  onNext,
  onPrevious,
  onRemoveImage,
  onAddToProject,
  availableTags,
  tagColors,
  batchQueue,
  imageAnnotations,
  onSetImageAnnotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  annotationsEnabled = true,
}) => {
  const [localTags, setLocalTags] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  // Annotation mode state
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);
  const [selectedTagForDrawing, setSelectedTagForDrawing] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [showNoTagWarning, setShowNoTagWarning] = useState(false);
  const noTagWarningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detection action state — per-image, session-scoped (persists across image navigation within modal)
  const [detectionActionsMap, setDetectionActionsMap] = useState<
    Map<string, Map<number, DetectionActionState>>
  >(new Map());

  // Image dimensions for AnnotationLayer positioning
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [imagePosition, setImagePosition] = useState({ left: 0, top: 0 });

  // Ref for the image container to calculate fit-to-window zoom
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [naturalImageSize, setNaturalImageSize] = useState({ width: 0, height: 0 });

  const tags = availableTags.length > 0 ? availableTags : [];
  const currentImage = selectedImages[currentIndex];
  const totalImages = selectedImages.length;

  // Get current image key and annotations
  const imageKey = currentImage ? `${currentImage.batchId}_${currentImage.boxNumber}` : '';
  const currentAnnotations = imageAnnotations.get(imageKey) || [];
  const currentDetectionActions = detectionActionsMap.get(imageKey) || new Map<number, DetectionActionState>();

  // Find the batch for the current image to get model and version
  const currentBatch = batchQueue.find(batch => batch.id === currentImage?.batchId);
  const model = currentBatch?.model || 'Unknown';
  const version = currentBatch?.version || 'Unknown';

  // Reset zoom and pan when image changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedAnnotationId(null);
    setShowRawData(false);
  }, [currentIndex]);

  // Exit annotation mode if annotations are disabled via settings
  useEffect(() => {
    if (!annotationsEnabled && isAnnotationMode) {
      setIsAnnotationMode(false);
      setSelectedTagForDrawing(null);
      setSelectedAnnotationId(null);
    }
  }, [annotationsEnabled, isAnnotationMode]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.5, 5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.5, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitToWindow = useCallback(() => {
    if (!imageContainerRef.current || naturalImageSize.width === 0) return;

    const container = imageContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    // Account for padding (p-6 = 24px on each side)
    const availableHeight = containerRect.height - 48;

    // Fit to height (Y) while maintaining aspect ratio
    const scaleY = availableHeight / naturalImageSize.height;
    const fitZoom = Math.min(scaleY, 5); // Cap at max zoom of 5

    setZoom(Math.max(fitZoom, 0.5)); // Ensure minimum zoom of 0.5
    setPan({ x: 0, y: 0 });
  }, [naturalImageSize]);

  // Handle dimension updates from ImageWithBoundingBoxes
  const handleDimensionsCalculated = useCallback((dims: {
    imageDimensions: { width: number; height: number };
    imagePosition: { left: number; top: number };
    naturalDimensions?: { width: number; height: number };
  }) => {
    setImageDimensions(dims.imageDimensions);
    setImagePosition(dims.imagePosition);
    if (dims.naturalDimensions) {
      setNaturalImageSize(dims.naturalDimensions);
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't handle pan when in annotation mode - annotations take priority
    if (isAnnotationMode) {
      return;
    }
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Toggle annotation mode
  const toggleAnnotationMode = useCallback(() => {
    setIsAnnotationMode((prev) => {
      if (prev) {
        // Exiting annotation mode
        setSelectedTagForDrawing(null);
        setSelectedAnnotationId(null);
      }
      return !prev;
    });
  }, []);

  // Handle drawing label click — single-select for annotation tool
  const handleDrawingLabelClick = (tag: string) => {
    if (selectedAnnotationId) {
      // Reassign selected annotation to this tag
      const annotation = currentAnnotations.find((a) => a.id === selectedAnnotationId);
      if (annotation && annotation.title !== tag) {
        onUpdateAnnotation(imageKey, selectedAnnotationId, {
          title: tag,
          flag: tagColors[tag] || '#3b82f6',
        });
        // Ensure the new tag is in upload tags
        setLocalTags((prev) => prev.includes(tag) ? prev : [...prev, tag]);
      }
    } else {
      setSelectedTagForDrawing((prev) => (prev === tag ? null : tag));
    }
  };

  // Handle upload tag click — multi-select for upload
  const handleUploadTagClick = (tag: string) => {
    setLocalTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Annotation handlers
  const handleAddAnnotation = useCallback((annotation: ManualAnnotation) => {
    onAddAnnotation(imageKey, annotation);
    // Auto-add the annotation's tag to upload tags (enables the upload button)
    setLocalTags((prev) =>
      prev.includes(annotation.title) ? prev : [...prev, annotation.title]
    );
  }, [imageKey, onAddAnnotation]);

  const handleUpdateAnnotation = useCallback((annotationId: string, updates: Partial<ManualAnnotation>) => {
    onUpdateAnnotation(imageKey, annotationId, updates);
  }, [imageKey, onUpdateAnnotation]);

  const handleDeleteAnnotation = useCallback((annotationId: string) => {
    onDeleteAnnotation(imageKey, annotationId);
    if (selectedAnnotationId === annotationId) {
      setSelectedAnnotationId(null);
    }
  }, [imageKey, onDeleteAnnotation, selectedAnnotationId]);

  const handleSelectAnnotation = useCallback((id: string | null) => {
    setSelectedAnnotationId(id);
  }, []);

  const handleClearAllAnnotations = useCallback(() => {
    onSetImageAnnotations(imageKey, []);
    setSelectedAnnotationId(null);
  }, [imageKey, onSetImageAnnotations]);

  // Detection action handlers
  const handleDetectionAction = useCallback((index: number, action: DetectionActionState) => {
    setDetectionActionsMap((prev) => {
      const next = new Map(prev);
      const imageActions = new Map(next.get(imageKey) || new Map<number, DetectionActionState>());
      imageActions.set(index, action);
      next.set(imageKey, imageActions);
      return next;
    });
  }, [imageKey]);

  const handleConvertToAnnotation = useCallback((detection: BoundingBox, index: number) => {
    const newAnnotation: ManualAnnotation = {
      id: `ann_conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      index: currentAnnotations.length,
      title: detection.label || 'Detection',
      tool: 'tagBox',
      flag: detection.color || '#3b82f6',
      shape: {
        p1: { x: detection.x, y: detection.y },
        p2: { x: detection.x + detection.width, y: detection.y + detection.height },
      },
      convertedFromDetectionIndex: index,
    };
    onAddAnnotation(imageKey, newAnnotation);
    setLocalTags((prev) =>
      prev.includes(newAnnotation.title) ? prev : [...prev, newAnnotation.title]
    );
    // Mark detection as converted (rejected)
    handleDetectionAction(index, { status: 'rejected' });
  }, [imageKey, currentAnnotations.length, onAddAnnotation, handleDetectionAction]);

  const handleUndoConversion = useCallback((annotation: ManualAnnotation) => {
    const detIndex = annotation.convertedFromDetectionIndex;
    onDeleteAnnotation(imageKey, annotation.id);
    if (selectedAnnotationId === annotation.id) {
      setSelectedAnnotationId(null);
    }
    if (detIndex !== undefined) {
      setDetectionActionsMap((prev) => {
        const next = new Map(prev);
        const imageActions = new Map(next.get(imageKey) || new Map<number, DetectionActionState>());
        imageActions.delete(detIndex);
        next.set(imageKey, imageActions);
        return next;
      });
    }
  }, [imageKey, onDeleteAnnotation, selectedAnnotationId]);

  const handleResetAllDetectionActions = useCallback(() => {
    // Remove all annotations that were converted from detections
    const remaining = currentAnnotations.filter(a => a.convertedFromDetectionIndex === undefined);
    if (remaining.length !== currentAnnotations.length) {
      onSetImageAnnotations(imageKey, remaining);
      if (selectedAnnotationId && !remaining.find(a => a.id === selectedAnnotationId)) {
        setSelectedAnnotationId(null);
      }
    }
    // Clear all detection action states
    setDetectionActionsMap((prev) => {
      const next = new Map(prev);
      next.delete(imageKey);
      return next;
    });
  }, [imageKey, currentAnnotations, onSetImageAnnotations, selectedAnnotationId]);

  // Keyboard navigation and shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          if (isAnnotationMode) {
            setIsAnnotationMode(false);
            setSelectedTagForDrawing(null);
            setSelectedAnnotationId(null);
          } else {
            onClose();
          }
          break;
        case 'ArrowLeft':
          if (currentIndex > 0) onPrevious();
          break;
        case 'ArrowRight':
          if (currentIndex < totalImages - 1) onNext();
          break;
        case 'a':
        case 'A':
          if (!e.ctrlKey && !e.metaKey && annotationsEnabled) {
            e.preventDefault();
            toggleAnnotationMode();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, totalImages, onClose, onNext, onPrevious, isAnnotationMode, toggleAnnotationMode, annotationsEnabled]);

  const handleRemove = () => {
    const imageKey = `${currentImage.batchId}_${currentImage.boxNumber}`;
    onRemoveImage(imageKey);
    setLocalTags([]);

    // Auto-advance to next or close if last
    if (currentIndex < totalImages - 1) {
      onNext();
    } else if (totalImages === 1) {
      onClose();
    } else {
      onPrevious();
    }
  };

  const handleAddToProject = async () => {
    if (localTags.length === 0) {
      alert('Please select at least one tag before adding to project');
      return;
    }

    setIsProcessing(true);
    try {
      await onAddToProject(currentImage, localTags, currentAnnotations);
      setLocalTags([]);

      // Auto-advance to next or close if last
      if (currentIndex < totalImages - 1) {
        onNext();
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Failed to add image to project:', error);
      alert('Failed to add image to project. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddAllRemaining = async () => {
    if (localTags.length === 0) {
      alert('Please select at least one tag before adding to project');
      return;
    }

    setIsProcessing(true);
    try {
      // Add all remaining images with their own annotations
      for (let i = currentIndex; i < totalImages; i++) {
        const img = selectedImages[i];
        const imgKey = `${img.batchId}_${img.boxNumber}`;
        const imgAnnotations = imageAnnotations.get(imgKey) || [];
        await onAddToProject(img, localTags, imgAnnotations);
      }
      setLocalTags([]);
      onClose();
    } catch (error) {
      console.error('Failed to add images to project:', error);
      alert('Failed to add all images to project. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Flash state for drawing label section
  const [drawingLabelFlash, setDrawingLabelFlash] = useState(false);

  // Show no-tag warning with auto-dismiss + visual flash on the drawing label section
  const triggerNoTagWarning = useCallback(() => {
    if (noTagWarningTimer.current) clearTimeout(noTagWarningTimer.current);
    setShowNoTagWarning(true);
    setDrawingLabelFlash(true);
    noTagWarningTimer.current = setTimeout(() => {
      setShowNoTagWarning(false);
      setDrawingLabelFlash(false);
    }, 3000);
  }, []);

  // Get cursor style
  const getCursorStyle = () => {
    if (isAnnotationMode) {
      return selectedTagForDrawing ? 'crosshair' : 'default';
    }
    if (zoom > 1) {
      return isDragging ? 'grabbing' : 'grab';
    }
    return 'default';
  };

  if (!isOpen || !currentImage) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-[1382px] h-[95vh] bg-primary rounded-xl shadow-elevated overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-white text-xl font-semibold flex items-center gap-2.5">
            Image Review
            <span className="bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-xs font-medium">
              {totalImages}
            </span>
          </h2>

          {/* Center Info - Camera ID and Result */}
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3">
            <span className="text-white text-lg font-semibold">{currentImage.cameraId}</span>
            <div
              className={`px-3 py-1 rounded-full font-bold text-sm ${
                currentImage.result === 'PASS'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : currentImage.result === 'FAIL'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
              }`}
            >
              {currentImage.result}
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-text-secondary hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Content - Split Layout */}
        <div className="flex-1 overflow-y-auto flex">
          {/* Left Side - Large Image Display with Zoom */}
          <div className="flex-1 flex flex-col bg-black relative">
            {/* Raw JSON Data Overlay — covers entire left column */}
            {showRawData && (
              <div className="absolute inset-0 z-30 flex flex-col bg-primary-lighter">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    Raw JSON Data
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const obj = {
                          batchId: currentImage.batchId,
                          model,
                          version,
                          project_id: currentBatch?.project_id ?? null,
                          boxNumber: currentImage.boxNumber,
                          cameraId: currentImage.cameraId,
                          result: currentImage.result,
                          reason: currentImage.reason,
                          timestamp: currentImage.timestamp,
                          imageData: `[Base64 — ${(currentImage.imageData?.length || 0).toLocaleString()} chars]`,
                          detections: currentImage.detections ?? [],
                          ...(currentAnnotations.length > 0 ? { annotations: currentAnnotations } : {}),
                        };
                        navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
                        setJsonCopied(true);
                        setTimeout(() => setJsonCopied(false), 2000);
                      }}
                      className={`transition-colors px-2 py-1 rounded flex items-center gap-1.5 text-xs ${
                        jsonCopied
                          ? 'text-green-400 bg-green-600/20'
                          : 'text-text-secondary hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {jsonCopied ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => { setShowRawData(false); setIsInfoExpanded(false); }}
                      className="text-text-secondary hover:text-white transition-colors p-1 rounded hover:bg-white/10"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <JsonTree
                    data={{
                      batchId: currentImage.batchId,
                      model,
                      version,
                      project_id: currentBatch?.project_id ?? null,
                      boxNumber: currentImage.boxNumber,
                      cameraId: currentImage.cameraId,
                      result: currentImage.result,
                      reason: currentImage.reason,
                      timestamp: currentImage.timestamp,
                      imageData: `[Base64 — ${(currentImage.imageData?.length || 0).toLocaleString()} chars]`,
                      detections: currentImage.detections ?? [],
                      ...(currentAnnotations.length > 0 ? { annotations: currentAnnotations } : {}),
                    }}
                  />
                </div>
              </div>
            )}

            {/* Zoom and Annotation Controls */}
            <div className="flex items-center justify-center gap-2 p-3 bg-black/50 border-b border-border/30">
              {/* Annotation Mode Toggle - only shown when annotations are enabled */}
              {annotationsEnabled && (
                <>
                  <Tooltip content="Toggle Annotation Mode (A)" position="bottom">
                    <button
                      onClick={toggleAnnotationMode}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        isAnnotationMode
                          ? 'bg-blue-600 text-white'
                          : 'bg-primary-lighter hover:bg-primary text-white'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <span className="text-xs">{isAnnotationMode ? 'Drawing' : 'Annotate'}</span>
                    </button>
                  </Tooltip>

                  {isAnnotationMode && selectedTagForDrawing && (
                    <div className="px-2 py-1 rounded text-xs text-white bg-opacity-80 max-w-[120px] truncate" style={{ backgroundColor: tagColors[selectedTagForDrawing] || '#3b82f6' }}>
                      {selectedTagForDrawing}
                    </div>
                  )}
                </>
              )}

              <Tooltip content="Zoom Out (−)" position="bottom">
                <button
                  onClick={handleZoomOut}
                  className="px-3 py-1.5 bg-primary-lighter hover:bg-primary text-white rounded-lg transition-all flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                  <span className="text-xs">Zoom Out</span>
                </button>
              </Tooltip>
              <div className="px-4 py-1.5 bg-primary-lighter rounded-lg text-white text-sm font-mono min-w-[80px] text-center">
                {Math.round(zoom * 100)}%
              </div>
              <Tooltip content="Zoom In (+)" position="bottom">
                <button
                  onClick={handleZoomIn}
                  className="px-3 py-1.5 bg-primary-lighter hover:bg-primary text-white rounded-lg transition-all flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                  </svg>
                  <span className="text-xs">Zoom In</span>
                </button>
              </Tooltip>
              <Tooltip content="Reset to 100%" position="bottom">
                <button
                  onClick={handleResetZoom}
                  className="px-3 py-1.5 bg-primary-lighter hover:bg-primary text-white rounded-lg transition-all text-xs"
                >
                  Reset
                </button>
              </Tooltip>
              <Tooltip content="Fit image to window" position="bottom">
                <button
                  onClick={handleFitToWindow}
                  className="px-3 py-1.5 bg-primary-lighter hover:bg-primary text-white rounded-lg transition-all flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  <span className="text-xs">Fit</span>
                </button>
              </Tooltip>
              <div className="ml-4 text-xs">
                {isAnnotationMode
                  ? showNoTagWarning
                    ? <span className="text-yellow-400 font-medium">Select a tag from the sidebar to annotate</span>
                    : selectedTagForDrawing
                    ? <span className="text-text-muted">Click and drag to draw</span>
                    : <span className="text-text-muted">Select a tag to draw</span>
                  : zoom > 1 && !isAnnotationMode
                  ? <span className="text-text-muted">Click and drag to pan</span>
                  : null}
              </div>
            </div>

            {/* Image Container */}
            <div
              ref={imageContainerRef}
              className="flex-1 overflow-auto flex items-center justify-center p-6 relative"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: getCursorStyle() }}
            >
              {currentImage.imageData ? (
                <div
                  className="max-w-full max-h-full select-none relative"
                  style={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                  }}
                >
                  <ImageWithBoundingBoxes
                    src={currentImage.imageData}
                    alt={`Camera ${currentImage.cameraId}`}
                    detections={currentImage.detections}
                    className="rounded-lg"
                    zoom={zoom}
                    showLabels={true}
                    onDimensionsCalculated={handleDimensionsCalculated}
                    hideBoundingBoxes={true}
                  />
                  {/* Annotation Layer - only visible when dimensions are available */}
                  {imageDimensions.width > 0 && (
                    <AnnotationLayer
                      key={imageKey}
                      imageDimensions={imageDimensions}
                      imagePosition={imagePosition}
                      existingDetections={currentImage.detections}
                      manualAnnotations={currentAnnotations}
                      isAnnotationMode={isAnnotationMode}
                      selectedTagForDrawing={selectedTagForDrawing}
                      tagColors={tagColors}
                      selectedAnnotationId={selectedAnnotationId}
                      zoom={zoom}
                      onAddAnnotation={handleAddAnnotation}
                      onUpdateAnnotation={handleUpdateAnnotation}
                      onDeleteAnnotation={handleDeleteAnnotation}
                      onSelectAnnotation={handleSelectAnnotation}
                      onNoTagSelected={triggerNoTagWarning}
                      expandableDetections={true}
                      detectionActions={currentDetectionActions}
                      onDetectionAction={handleDetectionAction}
                      onConvertToAnnotation={handleConvertToAnnotation}
                      onUndoConversion={handleUndoConversion}
                      availableTags={tags}
                      modelName={model}
                      modelVersion={version}
                    />
                  )}
                </div>
              ) : (
                <div className="text-text-muted">No Image Data</div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Metadata and Tags */}
          <div className="w-64 bg-gradient-to-b from-primary-lighter to-primary border-l border-border/50 overflow-y-auto">
            {/* Annotation Tools Section - only visible in annotation mode */}
            {isAnnotationMode && (
              <div className="border-b border-border/30 p-4">
                <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Annotation Tools
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>Annotations:</span>
                    <span className="text-white font-medium">{currentAnnotations.length}</span>
                  </div>
                  {selectedAnnotationId && (
                    <button
                      onClick={() => handleDeleteAnnotation(selectedAnnotationId)}
                      className="w-full px-3 py-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-all text-sm flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Selected
                    </button>
                  )}
                  {currentAnnotations.length > 0 && (
                    <button
                      onClick={handleClearAllAnnotations}
                      className="w-full px-3 py-2 rounded-lg bg-primary/60 text-text-secondary hover:bg-primary border border-border/30 transition-all text-sm"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Detection Review Panel */}
            {currentImage.detections && currentImage.detections.length > 0 && (
              <div className="border-b border-border/30 p-4">
                <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                  <span className="text-[9px] font-bold bg-white text-gray-900 px-1.5 py-0.5 rounded">AI</span>
                  Detections ({currentImage.detections.length})
                </h3>
                <div className="space-y-1">
                  {currentImage.detections.map((det, i) => {
                    const action = currentDetectionActions.get(i);
                    const isConverted = currentAnnotations.some(
                      (a) => a.convertedFromDetectionIndex === i
                    );
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-2 text-xs py-1 ${
                          isConverted ? 'opacity-50' : action?.status === 'rejected' ? 'opacity-40' : ''
                        }`}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{
                            backgroundColor: isConverted
                              ? '#3b82f6'
                              : action?.status === 'accepted'
                              ? '#22c55e'
                              : action?.reclassifiedTo
                              ? (tagColors[action.reclassifiedTo] || det.color || '#ef4444')
                              : (det.color || '#ef4444'),
                          }}
                        />
                        <span
                          className={`flex-1 truncate ${
                            isConverted
                              ? 'line-through text-text-muted'
                              : action?.reclassifiedTo
                              ? 'line-through text-text-muted'
                              : 'text-white'
                          }`}
                        >
                          {det.label || 'Detection'}
                        </span>
                        {isConverted ? (
                          <>
                            <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400">
                              converted
                            </span>
                            <Tooltip content="Undo conversion" position="top">
                              <button
                                onClick={() => {
                                  const ann = currentAnnotations.find(a => a.convertedFromDetectionIndex === i);
                                  if (ann) handleUndoConversion(ann);
                                }}
                                className="text-amber-500 hover:text-amber-400 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                                  <path d="M8.5 3A5 5 0 1 1 4.5 12" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" fill="none" />
                                  <path d="M6 1L8.5 3L6 5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                </svg>
                              </button>
                            </Tooltip>
                          </>
                        ) : (
                          <>
                            {action?.reclassifiedTo && (
                              <span className="text-blue-400 text-[11px]">
                                {action.reclassifiedTo}
                              </span>
                            )}
                            {action?.status && (
                              <span
                                className={`text-[10px] px-1 py-0.5 rounded ${
                                  action.status === 'accepted'
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}
                              >
                                {action.status === 'rejected'
                                  ? action.rejectionReason === 'false_positive'
                                    ? 'false pos.'
                                    : action.rejectionReason === 'wrong_label'
                                    ? 'wrong label'
                                    : 'rejected'
                                  : action.status}
                              </span>
                            )}
                            {det.confidence !== undefined && !action?.status && (
                              <span className="text-text-muted">
                                {(det.confidence * 100).toFixed(0)}%
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                  {(currentDetectionActions.size > 0 || currentAnnotations.some(a => a.convertedFromDetectionIndex !== undefined)) && (
                    <button
                      onClick={handleResetAllDetectionActions}
                      className="w-full mt-2 py-1.5 rounded-lg border border-border/30 bg-transparent text-text-secondary hover:text-white hover:border-border/50 transition-colors text-xs"
                    >
                      {currentAnnotations.some(a => a.convertedFromDetectionIndex !== undefined)
                        ? 'Reset All (reverts conversions)'
                        : 'Reset All Actions'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Collapsible Image Info Section */}
            <div className="border-b border-border/30">
              <button
                onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-primary/30 transition-colors"
              >
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Image Info
                </h3>
                <svg
                  className={`w-4 h-4 text-text-secondary transition-transform ${isInfoExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isInfoExpanded && (
                <div className="px-4 pb-4 space-y-2.5">
                  <div className="bg-primary/50 rounded-lg p-2.5 border border-border/30">
                    <p className="text-text-muted text-[10px] uppercase mb-1">Model</p>
                    <p className="text-white text-sm font-semibold">{model}</p>
                  </div>

                  <div className="bg-primary/50 rounded-lg p-2.5 border border-border/30">
                    <p className="text-text-muted text-[10px] uppercase mb-1">Version</p>
                    <p className="text-white text-sm font-semibold">{version}</p>
                  </div>

                  <div className="bg-primary/50 rounded-lg p-2.5 border border-border/30">
                    <p className="text-text-muted text-[10px] uppercase mb-1">Camera</p>
                    <p className="text-white text-sm font-semibold">{currentImage.cameraId}</p>
                  </div>

                  <div className="bg-primary/50 rounded-lg p-2.5 border border-border/30">
                    <p className="text-text-muted text-[10px] uppercase mb-1">Timestamp</p>
                    <p className="text-white text-sm font-mono">
                      {formatTimestamp(currentImage.timestamp)}
                    </p>
                  </div>

                  <div className="bg-primary/50 rounded-lg p-2.5 border border-border/30">
                    <p className="text-text-muted text-[10px] uppercase mb-1">Batch ID</p>
                    <p className="text-white text-[11px] font-mono break-all">
                      {currentImage.batchId.split('_')[1]}
                    </p>
                  </div>

                  {currentImage.reason && (
                    <div className="bg-primary/50 rounded-lg p-2.5 border border-border/30">
                      <p className="text-text-muted text-[10px] uppercase mb-1">Reason</p>
                      <p className="text-white text-sm">{currentImage.reason}</p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      const next = !showRawData;
                      setShowRawData(next);
                      if (!next) setIsInfoExpanded(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                      showRawData
                        ? 'bg-blue-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    {showRawData ? 'Hide Raw Data' : 'View Raw Data'}
                  </button>
                </div>
              )}
            </div>

            {/* Drawing Label Section — always visible, interactive only in annotation mode */}
            {annotationsEnabled && (
              <div className={`border-b p-4 transition-all duration-500 ${!isAnnotationMode ? 'opacity-40 pointer-events-none border-border/30' : drawingLabelFlash ? 'border-amber-500 bg-amber-500/10' : 'border-border/30'}`}>
                <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Drawing Label
                </h3>
                {selectedAnnotationId && isAnnotationMode && (
                  <p className="text-xs text-blue-400 mb-2">Click a label to reassign selected annotation</p>
                )}
                <div className="space-y-1.5">
                  {tags.map((tag) => {
                    const isSelectedForDrawing = selectedTagForDrawing === tag;
                    const hexColor = tagColors[tag] || '#666666';
                    const tagAnnotationCount = currentAnnotations.filter((a) => a.title === tag).length;

                    return (
                      <button
                        key={tag}
                        onClick={() => handleDrawingLabelClick(tag)}
                        className={`w-full px-3 py-2 rounded-lg font-medium text-sm text-left transition-all ${
                          isSelectedForDrawing
                            ? 'text-white shadow-lg border-2 border-white'
                            : 'bg-primary/60 text-text-secondary hover:bg-primary border border-border/30 hover:border-border/50'
                        }`}
                        style={isSelectedForDrawing ? { backgroundColor: hexColor } : undefined}
                      >
                        <span className="flex items-center justify-between gap-2 min-w-0">
                          <span className="flex items-center gap-2 min-w-0">
                            {isSelectedForDrawing && (
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            )}
                            <span className="truncate">{tag}</span>
                          </span>
                          {tagAnnotationCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-white/20 flex-shrink-0">
                              {tagAnnotationCount}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Classification Section — always visible and interactive */}
            <div className="p-4">
              <h3 className="text-white font-semibold text-sm mb-1 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                Classification
              </h3>
              <p className="text-text-muted text-[10px] mb-2">Added to filename when uploading</p>
              <div className="space-y-1.5">
                {tags.map((tag) => {
                  const isSelectedForUpload = localTags.includes(tag);
                  const hexColor = tagColors[tag] || '#666666';
                  const tagAnnotationCount = currentAnnotations.filter((a) => a.title === tag).length;

                  return (
                    <button
                      key={tag}
                      onClick={() => handleUploadTagClick(tag)}
                      className={`w-full px-3 py-2 rounded-lg font-medium text-sm text-left transition-all ${
                        isSelectedForUpload
                          ? 'text-white shadow-lg border border-white/20'
                          : 'bg-primary/60 text-text-secondary hover:bg-primary border border-border/30 hover:border-border/50'
                      }`}
                      style={isSelectedForUpload ? { backgroundColor: hexColor } : undefined}
                    >
                      <span className="flex items-center justify-between gap-2 min-w-0">
                        <span className="flex items-center gap-2 min-w-0">
                          {isSelectedForUpload && (
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span className="truncate">{tag}</span>
                        </span>
                        {tagAnnotationCount > 0 && (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs flex-shrink-0"
                            style={{ backgroundColor: `${hexColor}40`, color: hexColor }}
                          >
                            {tagAnnotationCount}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-border px-6 py-4 space-y-3">
          {/* Navigation */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onPrevious}
              disabled={currentIndex === 0}
              className="px-4 py-2 rounded-lg bg-primary-lighter text-text-secondary hover:bg-primary-lighter/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ← Previous
            </button>
            <span className="text-text-secondary text-sm font-mono min-w-[60px] text-center">
              {currentIndex + 1} / {totalImages}
            </span>
            <button
              onClick={handleRemove}
              className="px-4 py-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-all"
            >
              Remove Selection
            </button>
            <button
              onClick={onNext}
              disabled={currentIndex === totalImages - 1}
              className="px-4 py-2 rounded-lg bg-primary-lighter text-text-secondary hover:bg-primary-lighter/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Next →
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddToProject}
              disabled={isProcessing || localTags.length === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-all"
            >
              {isProcessing ? 'Processing...' : `Add This Image${currentAnnotations.length > 0 ? ` (${currentAnnotations.length} annotations)` : ''}`}
            </button>
            <button
              onClick={handleAddAllRemaining}
              disabled={isProcessing || localTags.length === 0}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-all"
            >
              {isProcessing ? 'Processing...' : `Add All Remaining (${totalImages - currentIndex})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
