'use client';

import React from 'react';
import { SidebarProps } from '@/types';
import { Tooltip } from './Tooltip';

export const Sidebar: React.FC<SidebarProps> = ({
  selectedCount,
  availableTags,
  tagColors,
  selectedTags,
  multiTagMode,
  onToggleTag,
  onToggleMultiMode,
  onOpenReview,
  onAddToProject,
  onClearSelection,
}) => {
  const tags = availableTags.length > 0 ? availableTags : [];

  return (
    <aside className="fixed right-0 top-16 bottom-12 w-80 bg-primary/80 backdrop-blur-glass border-l border-border overflow-y-auto overflow-x-hidden">
      <div className="p-5 space-y-4">
        {/* Card 1: Selection */}
        <div className="bg-primary-lighter/30 rounded-lg border border-border/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">Selection</h3>
            <div className="bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-xs font-medium">
              {selectedCount}
            </div>
          </div>

          <Tooltip content="Select images from the grid first" position="left" disabled={selectedCount > 0} className="w-full">
            <button
              onClick={onOpenReview}
              disabled={selectedCount === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Review Selection
            </button>
          </Tooltip>

          <Tooltip content="Select images from the grid first" position="left" disabled={selectedCount > 0} className="w-full">
            <button
              onClick={onClearSelection}
              disabled={selectedCount === 0}
              className="w-full bg-transparent hover:bg-red-600/20 disabled:opacity-30 disabled:cursor-not-allowed text-red-400 hover:text-red-300 font-medium py-2 rounded-lg transition-all border border-red-600/40 hover:border-red-600/60 text-sm flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Selection
            </button>
          </Tooltip>
        </div>

        {/* Card 2: Classification */}
        <div className="bg-primary-lighter/30 rounded-lg border border-border/30 p-4 space-y-3">
          <div>
            <h3 className="text-white font-semibold text-sm">Classification</h3>
            <p className="text-text-muted text-xs mt-1">Selected tags are added to the filename when uploading</p>
          </div>

          {/* Multi-Tag Toggle */}
          <label className="flex items-center justify-between cursor-pointer py-1">
            <span className="text-text-secondary text-xs font-medium">Multi-Tag Mode</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={multiTagMode}
                onChange={(e) => onToggleMultiMode(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-9 h-5 rounded-full transition-colors ${
                  multiTagMode ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    multiTagMode ? 'transform translate-x-4' : ''
                  }`}
                ></div>
              </div>
            </div>
          </label>

          {/* Tag Buttons */}
          <div className="grid grid-cols-1 gap-1.5">
            {tags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              const hexColor = tagColors[tag] || '#666666';
              return (
                <button
                  key={tag}
                  onClick={() => onToggleTag(tag)}
                  className={`px-3 py-2.5 rounded-lg font-medium text-sm transition-all truncate ${
                    isSelected
                      ? 'text-white shadow-lg'
                      : 'bg-primary/40 text-text-secondary hover:bg-primary/60'
                  }`}
                  style={isSelected ? { backgroundColor: hexColor } : undefined}
                  title={tag}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Card 3: Upload */}
        <div className="bg-primary-lighter/30 rounded-lg border border-border/30 p-4 space-y-3">
          <div>
            <h3 className="text-white font-semibold text-sm">Upload</h3>
            <p className="text-text-muted text-xs mt-1">Send selected images to the cloud project</p>
          </div>

          {/* Tag preview pills */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded text-xs font-medium text-white truncate max-w-[120px]"
                  style={{ backgroundColor: tagColors[tag] || '#666666' }}
                  title={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <Tooltip content={selectedTags.length === 0 ? "Select a classification tag first" : selectedCount === 0 ? "Select images from the grid first" : ""} position="left" disabled={selectedCount > 0 && selectedTags.length > 0} className="w-full">
            <button
              onClick={onAddToProject}
              disabled={selectedCount === 0 || selectedTags.length === 0}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload to Project
            </button>
          </Tooltip>

          {selectedTags.length === 0 && selectedCount > 0 && (
            <p className="text-amber-400/70 text-xs text-center">Select a tag above first</p>
          )}
        </div>
      </div>
    </aside>
  );
};
