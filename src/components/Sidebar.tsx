'use client';

import React, { useState } from 'react';
import { SidebarProps } from '@/types';

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
}) => {
  const tags = availableTags.length > 0 ? availableTags : [];
  const [showTagInfo, setShowTagInfo] = useState(false);

  return (
    <aside className="fixed right-0 top-16 bottom-12 w-80 bg-primary/80 backdrop-blur-glass border-l border-border overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Selection Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Selection</h3>
            <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
              {selectedCount}
            </div>
          </div>

          <button
            onClick={onOpenReview}
            disabled={selectedCount === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-all"
          >
            Review Selected Images
          </button>

          <button
            onClick={onAddToProject}
            disabled={selectedCount === 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-all"
          >
            Add Selected Images to Project
          </button>
        </div>

        {/* Multi-Select Toggle */}
        <div className="bg-primary-lighter/50 rounded-lg p-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-text-secondary text-sm font-medium">Multi-Tag Mode</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={multiTagMode}
                onChange={(e) => onToggleMultiMode(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-11 h-6 rounded-full transition-colors ${
                  multiTagMode ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    multiTagMode ? 'transform translate-x-5' : ''
                  }`}
                ></div>
              </div>
            </div>
          </label>
          <p className="text-text-muted text-xs mt-2">
            {multiTagMode ? 'Select multiple tags' : 'Select single tag only'}
          </p>
        </div>

        {/* Tags Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold">Tag Labels</h3>
            <button
              onMouseEnter={() => setShowTagInfo(true)}
              onMouseLeave={() => setShowTagInfo(false)}
              className="w-5 h-5 rounded-full bg-blue-600/20 hover:bg-blue-600/40 flex items-center justify-center transition-colors"
            >
              <svg
                className="w-3 h-3 text-blue-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {showTagInfo && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 -mt-1">
              <p className="text-text-secondary text-xs leading-relaxed">
                Selected tag labels determine the filename when adding images to the project.
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-blue-400 text-xs font-mono">
                  Single tag: missing_pin.jpg
                </p>
                <p className="text-blue-400 text-xs font-mono break-all">
                  Multiple: missing_pin_bodies_damage.jpg
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-2">
            {tags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              const hexColor = tagColors[tag] || '#666666';
              return (
                <button
                  key={tag}
                  onClick={() => onToggleTag(tag)}
                  className={`px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                    isSelected
                      ? 'text-white shadow-lg scale-105'
                      : 'bg-primary-lighter/30 text-text-secondary hover:bg-primary-lighter/50'
                  }`}
                  style={isSelected ? { backgroundColor: hexColor } : undefined}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
