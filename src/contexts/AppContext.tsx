'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { AppState, InspectionBatch, SocketInspectionData } from '@/types';
import { MAX_BATCH_QUEUE } from '@/lib/constants';
import { processSocketData, setBatchCompleteCallback } from '@/lib/batchProcessor';
import { addBatchToCollection, setTagColors, getTotalCount } from '@/lib/collectionStore';

type AppAction =
  | { type: 'SET_PAUSED'; payload: boolean }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'ADD_BATCH'; payload: InspectionBatch }
  | { type: 'SET_QUEUE_INDEX'; payload: number }
  | { type: 'TOGGLE_IMAGE_SELECTION'; payload: { batchId: string; boxNumber: number } }
  | { type: 'SET_REVIEW_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_REVIEW_CAROUSEL_INDEX'; payload: number }
  | { type: 'TOGGLE_TAG'; payload: string }
  | { type: 'SET_MULTI_TAG_MODE'; payload: boolean }
  | { type: 'SET_AVAILABLE_TAGS'; payload: string[] }
  | { type: 'SET_TAG_COLORS'; payload: Record<string, string> }
  | { type: 'SET_CAMERA_FILTER'; payload: string }
  | { type: 'REMOVE_SELECTED_IMAGE'; payload: string }
  | { type: 'ASSIGN_TAGS_TO_IMAGE'; payload: { imageKey: string; tags: string[] } }
  | { type: 'CLEAR_SELECTIONS' }
  | { type: 'CLEAR_BATCH_QUEUE' };

const initialState: AppState = {
  isStreamPaused: false,
  isConnected: false,
  currentBatch: null,
  batchQueue: [],
  queueIndex: 0,
  selectedImages: new Map(),
  isReviewModalOpen: false,
  reviewCarouselIndex: 0,
  availableTags: [],
  tagColors: {},
  selectedTags: [],
  multiTagMode: false,
  modelInfo: {
    name: '',
    version: '',
  },
  cameraFilter: 'all',
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_PAUSED':
      return { ...state, isStreamPaused: action.payload };

    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };

    case 'ADD_BATCH': {
      const newQueue = [...state.batchQueue, action.payload];
      let newSelectedImages = state.selectedImages;

      // Keep only last 5 batches (FIFO)
      if (newQueue.length > MAX_BATCH_QUEUE) {
        const removedBatch = newQueue.shift();

        // Clean up selected images from the removed batch
        if (removedBatch) {
          const updatedSelectedImages = new Map(state.selectedImages);
          // Remove all images that have the removed batch's ID
          for (const [imageKey] of updatedSelectedImages) {
            if (imageKey.startsWith(`${removedBatch.id}_`)) {
              updatedSelectedImages.delete(imageKey);
            }
          }
          newSelectedImages = updatedSelectedImages;
        }
      }

      // If not paused, update current batch and index to newest
      if (!state.isStreamPaused) {
        return {
          ...state,
          batchQueue: newQueue,
          currentBatch: action.payload,
          queueIndex: newQueue.length - 1,
          selectedImages: newSelectedImages,
        };
      }

      // If paused, just add to queue, don't change current view
      return {
        ...state,
        batchQueue: newQueue,
        selectedImages: newSelectedImages,
      };
    }

    case 'SET_QUEUE_INDEX':
      return {
        ...state,
        queueIndex: action.payload,
        currentBatch: state.batchQueue[action.payload] || null,
      };

    case 'TOGGLE_IMAGE_SELECTION': {
      const { batchId, boxNumber } = action.payload;
      const imageKey = `${batchId}_${boxNumber}`;
      const newSelectedImages = new Map(state.selectedImages);

      if (newSelectedImages.has(imageKey)) {
        newSelectedImages.delete(imageKey);
      } else {
        // Find the image in the batch
        const batch = state.batchQueue.find((b) => b.id === batchId);
        const roi = batch?.rois.find((r) => r.boxNumber === boxNumber);
        if (roi) {
          newSelectedImages.set(imageKey, {
            ...roi,
            selected: true,
            assignedTags: [],
          });
        }
      }

      return { ...state, selectedImages: newSelectedImages };
    }

    case 'SET_REVIEW_MODAL_OPEN':
      return {
        ...state,
        isReviewModalOpen: action.payload,
        reviewCarouselIndex: action.payload ? 0 : state.reviewCarouselIndex,
      };

    case 'SET_REVIEW_CAROUSEL_INDEX':
      return { ...state, reviewCarouselIndex: action.payload };

    case 'TOGGLE_TAG': {
      const tag = action.payload;
      if (state.multiTagMode) {
        // Multi-select: toggle
        const newTags = state.selectedTags.includes(tag)
          ? state.selectedTags.filter((t) => t !== tag)
          : [...state.selectedTags, tag];
        return { ...state, selectedTags: newTags };
      } else {
        // Single-select: replace
        return { ...state, selectedTags: [tag] };
      }
    }

    case 'SET_MULTI_TAG_MODE': {
      // When switching to single mode, keep only first tag
      const newTags =
        !action.payload && state.selectedTags.length > 1
          ? [state.selectedTags[0]]
          : state.selectedTags;
      return {
        ...state,
        multiTagMode: action.payload,
        selectedTags: newTags,
      };
    }

    case 'SET_AVAILABLE_TAGS':
      return { ...state, availableTags: action.payload };

    case 'SET_TAG_COLORS':
      return { ...state, tagColors: action.payload };

    case 'SET_CAMERA_FILTER':
      return { ...state, cameraFilter: action.payload };

    case 'REMOVE_SELECTED_IMAGE': {
      const newSelectedImages = new Map(state.selectedImages);
      newSelectedImages.delete(action.payload);
      return { ...state, selectedImages: newSelectedImages };
    }

    case 'ASSIGN_TAGS_TO_IMAGE': {
      const { imageKey, tags } = action.payload;
      const newSelectedImages = new Map(state.selectedImages);
      const image = newSelectedImages.get(imageKey);
      if (image) {
        newSelectedImages.set(imageKey, { ...image, assignedTags: tags });
      }
      return { ...state, selectedImages: newSelectedImages };
    }

    case 'CLEAR_SELECTIONS':
      return {
        ...state,
        selectedImages: new Map(),
        selectedTags: [],
        reviewCarouselIndex: 0,
      };

    case 'CLEAR_BATCH_QUEUE':
      return {
        ...state,
        batchQueue: [],
        currentBatch: null,
        queueIndex: 0,
      };

    default:
      return state;
  }
};

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  togglePause: () => void;
  handleSocketData: (data: SocketInspectionData) => void;
  getCollectionCount: () => number;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Set up batch completion callback once
  useEffect(() => {
    setBatchCompleteCallback((batch: InspectionBatch) => {
      console.log('[AppContext] Batch completed:', batch.id, 'with', batch.rois.length, 'cameras');
      dispatch({ type: 'ADD_BATCH', payload: batch });

      // Add to collection store for download feature
      addBatchToCollection(batch.rois);
    });
  }, []);

  // Sync tag colors to collection store when they change
  useEffect(() => {
    if (Object.keys(state.tagColors).length > 0) {
      setTagColors(state.tagColors);
    }
  }, [state.tagColors]);

  // Get collection count for header badge
  const getCollectionCount = useCallback(() => {
    return getTotalCount();
  }, []);

  const togglePause = useCallback(() => {
    dispatch({ type: 'SET_PAUSED', payload: !state.isStreamPaused });

    // When resuming, jump to newest batch
    if (state.isStreamPaused && state.batchQueue.length > 0) {
      dispatch({ type: 'SET_QUEUE_INDEX', payload: state.batchQueue.length - 1 });
    }
  }, [state.isStreamPaused, state.batchQueue.length]);

  const handleSocketData = useCallback((data: SocketInspectionData) => {
    // Just process the message - batch will be added via callback when complete
    processSocketData(data);
  }, []);

  const value: AppContextValue = {
    state,
    dispatch,
    togglePause,
    handleSocketData,
    getCollectionCount,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};
