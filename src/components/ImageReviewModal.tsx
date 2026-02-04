'use client';

import React, { useState, useEffect } from 'react';
import { ImageReviewModalProps } from '@/types';
import { ImageWithBoundingBoxes } from './ImageWithBoundingBoxes';
import { Tooltip } from './Tooltip';

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
}) => {
  const [localTags, setLocalTags] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

  const tags = availableTags.length > 0 ? availableTags : [];
  const currentImage = selectedImages[currentIndex];
  const totalImages = selectedImages.length;

  // Find the batch for the current image to get model and version
  const currentBatch = batchQueue.find(batch => batch.id === currentImage?.batchId);
  const model = currentBatch?.model || 'Unknown';
  const version = currentBatch?.version || 'Unknown';

  // Reset zoom and pan when image changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentIndex]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.5, 5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.5, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
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


  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (currentIndex > 0) onPrevious();
          break;
        case 'ArrowRight':
          if (currentIndex < totalImages - 1) onNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, totalImages, onClose, onNext, onPrevious]);

  const handleToggleTag = (tag: string) => {
    setLocalTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

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
      await onAddToProject(currentImage, localTags);
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
      // Add all remaining images with the same tags
      for (let i = currentIndex; i < totalImages; i++) {
        await onAddToProject(selectedImages[i], localTags);
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

  if (!isOpen || !currentImage) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-6xl h-[90vh] bg-primary rounded-xl shadow-elevated overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-white text-xl font-semibold">
            Image Review ({currentIndex + 1} of {totalImages})
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
          <div className="flex-1 flex flex-col bg-black">
            {/* Zoom Controls */}
            <div className="flex items-center justify-center gap-2 p-3 bg-black/50 border-b border-border/30">
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
              <div className="ml-4 text-text-muted text-xs">
                {zoom > 1 ? 'Click and drag to pan' : ''}
              </div>
            </div>

            {/* Image Container */}
            <div
              className="flex-1 overflow-auto flex items-center justify-center p-6"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            >
              {currentImage.imageData ? (
                <div
                  className="max-w-full max-h-full select-none"
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
                  />
                </div>
              ) : (
                <div className="text-text-muted">No Image Data</div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Metadata */}
          <div className="w-64 bg-gradient-to-b from-primary-lighter to-primary border-l border-border/50 overflow-y-auto">
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
                    <p className="text-text-muted text-[10px] uppercase tracking-wider mb-1">Model</p>
                    <p className="text-white text-sm font-semibold">{model}</p>
                  </div>

                  <div className="bg-primary/50 rounded-lg p-2.5 border border-border/30">
                    <p className="text-text-muted text-[10px] uppercase tracking-wider mb-1">Version</p>
                    <p className="text-white text-sm font-semibold">{version}</p>
                  </div>

                  <div className="bg-primary/50 rounded-lg p-2.5 border border-border/30">
                    <p className="text-text-muted text-[10px] uppercase tracking-wider mb-1">Camera</p>
                    <p className="text-white text-sm font-semibold">{currentImage.cameraId}</p>
                  </div>

                  <div className="bg-primary/50 rounded-lg p-2.5 border border-border/30">
                    <p className="text-text-muted text-[10px] uppercase tracking-wider mb-1">Timestamp</p>
                    <p className="text-white text-sm font-mono">
                      {formatTimestamp(currentImage.timestamp)}
                    </p>
                  </div>

                  <div className="bg-primary/50 rounded-lg p-2.5 border border-border/30">
                    <p className="text-text-muted text-[10px] uppercase tracking-wider mb-1">Batch ID</p>
                    <p className="text-white text-[11px] font-mono break-all">
                      {currentImage.batchId.split('_')[1]}
                    </p>
                  </div>

                  {currentImage.reason && (
                    <div className="bg-primary/50 rounded-lg p-2.5 border border-border/30">
                      <p className="text-text-muted text-[10px] uppercase tracking-wider mb-1">Reason</p>
                      <p className="text-white text-sm">{currentImage.reason}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tag Selection Section */}
            <div className="p-4">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                Tag Selection
              </h3>
              <div className="space-y-2">
                {tags.map((tag) => {
                  const isSelected = localTags.includes(tag);
                  const hexColor = tagColors[tag] || '#666666';
                  return (
                    <button
                      key={tag}
                      onClick={() => handleToggleTag(tag)}
                      className={`w-full px-3 py-2.5 rounded-lg font-medium text-sm text-left transition-all transform hover:scale-[1.02] ${
                        isSelected
                          ? 'text-white shadow-lg border border-white/20'
                          : 'bg-primary/60 text-text-secondary hover:bg-primary border border-border/30 hover:border-border/50'
                      }`}
                      style={isSelected ? { backgroundColor: hexColor } : undefined}
                    >
                      <span className="flex items-center gap-2">
                        {isSelected && (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                        {tag}
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
              {isProcessing ? 'Processing...' : 'Add This Image to Project'}
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
