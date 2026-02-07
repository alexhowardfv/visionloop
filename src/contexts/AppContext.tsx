'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { AppState, InspectionBatch, SocketInspectionData, ManualAnnotation } from '@/types';
import { MAX_BATCH_QUEUE } from '@/lib/constants';
import { processSocketData, setBatchCompleteCallback } from '@/lib/batchProcessor';
import { addBatchToCollection, setTagColors, getTotalCount } from '@/lib/collectionStore';

type AppAction =
  | { type: 'SET_PAUSED'; payload: boolean }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'ADD_BATCH'; payload: InspectionBatch }
  | { type: 'SET_QUEUE_INDEX'; payload: number }
  | { type: 'TRIM_AND_RESUME' }
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
  | { type: 'CLEAR_BATCH_QUEUE' }
  | { type: 'SET_MAX_BATCH_QUEUE'; payload: number }
  // Annotation actions
  | { type: 'SET_IMAGE_ANNOTATIONS'; payload: { imageKey: string; annotations: ManualAnnotation[] } }
  | { type: 'ADD_IMAGE_ANNOTATION'; payload: { imageKey: string; annotation: ManualAnnotation } }
  | { type: 'UPDATE_IMAGE_ANNOTATION'; payload: { imageKey: string; annotationId: string; updates: Partial<ManualAnnotation> } }
  | { type: 'DELETE_IMAGE_ANNOTATION'; payload: { imageKey: string; annotationId: string } }
  | { type: 'CLEAR_IMAGE_ANNOTATIONS'; payload: { imageKey: string } };

const initialState: AppState = {
  isStreamPaused: false,
  isConnected: false,
  currentBatch: null,
  batchQueue: [],
  queueIndex: 0,
  selectedImages: new Map(),
  isReviewModalOpen: false,
  wasPausedBeforeReview: false,
  reviewCarouselIndex: 0,
  availableTags: [],
  tagColors: {},
  selectedTags: [],
  multiTagMode: false,
  imageAnnotations: new Map(),
  maxBatchQueue: MAX_BATCH_QUEUE,
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
      // If paused, drop incoming batches entirely - queue is frozen for browsing
      if (state.isStreamPaused) {
        return state;
      }

      const newQueue = [...state.batchQueue, action.payload];

      // Enforce user-configured queue limit (FIFO: drop oldest first)
      while (newQueue.length > state.maxBatchQueue) {
        newQueue.shift();
      }

      // Reconcile: deselect images whose batch is no longer in the queue
      const queueBatchIds = new Set(newQueue.map(b => b.id));
      let newSelectedImages = state.selectedImages;
      for (const [imageKey, image] of state.selectedImages) {
        if (!queueBatchIds.has(image.batchId)) {
          if (newSelectedImages === state.selectedImages) {
            newSelectedImages = new Map(state.selectedImages);
          }
          newSelectedImages.delete(imageKey);
        }
      }

      // If user was viewing the latest batch (or queue was empty), auto-advance
      const wasOnLatest = state.batchQueue.length === 0 ||
        state.queueIndex === state.batchQueue.length - 1;

      let newIndex: number;
      let newCurrentBatch: InspectionBatch;

      if (wasOnLatest) {
        newIndex = newQueue.length - 1;
        newCurrentBatch = action.payload;
      } else {
        // User pinned to an older batch — try to keep them on it
        const pinnedBatchId = state.currentBatch?.id;
        const pinnedIdx = pinnedBatchId
          ? newQueue.findIndex(b => b.id === pinnedBatchId)
          : -1;

        if (pinnedIdx >= 0) {
          // Batch still in queue, stay on it (index may have shifted)
          newIndex = pinnedIdx;
          newCurrentBatch = newQueue[pinnedIdx];
        } else {
          // Batch was popped off — jump to latest
          newIndex = newQueue.length - 1;
          newCurrentBatch = action.payload;
        }
      }

      return {
        ...state,
        batchQueue: newQueue,
        currentBatch: newCurrentBatch,
        queueIndex: newIndex,
        selectedImages: newSelectedImages,
      };
    }

    case 'SET_QUEUE_INDEX':
      return {
        ...state,
        queueIndex: action.payload,
        currentBatch: state.batchQueue[action.payload] || null,
      };

    case 'TRIM_AND_RESUME': {
      const trimmedQueue = [...state.batchQueue];

      // Trim to user-configured limit, keeping newest batches
      while (trimmedQueue.length > state.maxBatchQueue) {
        trimmedQueue.shift();
      }

      // Reconcile: deselect images whose batch is no longer in the queue
      const queueBatchIds = new Set(trimmedQueue.map(b => b.id));
      let newSelectedImages = state.selectedImages;
      for (const [imageKey, image] of state.selectedImages) {
        if (!queueBatchIds.has(image.batchId)) {
          if (newSelectedImages === state.selectedImages) {
            newSelectedImages = new Map(state.selectedImages);
          }
          newSelectedImages.delete(imageKey);
        }
      }

      const newestIndex = Math.max(trimmedQueue.length - 1, 0);
      return {
        ...state,
        batchQueue: trimmedQueue,
        currentBatch: trimmedQueue[newestIndex] || null,
        queueIndex: newestIndex,
        selectedImages: newSelectedImages,
      };
    }

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
      if (action.payload) {
        // Opening review: auto-pause, remember if we were already paused
        return {
          ...state,
          isReviewModalOpen: true,
          reviewCarouselIndex: 0,
          wasPausedBeforeReview: state.isStreamPaused,
          isStreamPaused: true,
        };
      }
      // Closing review: restore previous pause state
      return {
        ...state,
        isReviewModalOpen: false,
        isStreamPaused: state.wasPausedBeforeReview ?? false,
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

    case 'SET_MAX_BATCH_QUEUE': {
      const newLimit = action.payload;
      const trimmedQueue = [...state.batchQueue];

      // Immediately trim queue to new limit (drop oldest)
      while (trimmedQueue.length > newLimit) {
        trimmedQueue.shift();
      }

      // Reconcile selections after trimming
      const queueBatchIds = new Set(trimmedQueue.map(b => b.id));
      let newSelectedImages = state.selectedImages;
      for (const [imageKey, image] of state.selectedImages) {
        if (!queueBatchIds.has(image.batchId)) {
          if (newSelectedImages === state.selectedImages) {
            newSelectedImages = new Map(state.selectedImages);
          }
          newSelectedImages.delete(imageKey);
        }
      }

      const newIndex = Math.min(state.queueIndex, Math.max(trimmedQueue.length - 1, 0));
      return {
        ...state,
        maxBatchQueue: newLimit,
        batchQueue: trimmedQueue,
        currentBatch: trimmedQueue[newIndex] || null,
        queueIndex: newIndex,
        selectedImages: newSelectedImages,
      };
    }

    // Annotation actions
    case 'SET_IMAGE_ANNOTATIONS': {
      const { imageKey, annotations } = action.payload;
      const newAnnotations = new Map(state.imageAnnotations);
      newAnnotations.set(imageKey, annotations);
      return { ...state, imageAnnotations: newAnnotations };
    }

    case 'ADD_IMAGE_ANNOTATION': {
      const { imageKey, annotation } = action.payload;
      const newAnnotations = new Map(state.imageAnnotations);
      const existing = newAnnotations.get(imageKey) || [];
      newAnnotations.set(imageKey, [...existing, annotation]);
      return { ...state, imageAnnotations: newAnnotations };
    }

    case 'UPDATE_IMAGE_ANNOTATION': {
      const { imageKey, annotationId, updates } = action.payload;
      const newAnnotations = new Map(state.imageAnnotations);
      const existing = newAnnotations.get(imageKey) || [];
      const updated = existing.map(ann =>
        ann.id === annotationId ? { ...ann, ...updates } : ann
      );
      newAnnotations.set(imageKey, updated);
      return { ...state, imageAnnotations: newAnnotations };
    }

    case 'DELETE_IMAGE_ANNOTATION': {
      const { imageKey, annotationId } = action.payload;
      const newAnnotations = new Map(state.imageAnnotations);
      const existing = newAnnotations.get(imageKey) || [];
      const filtered = existing.filter(ann => ann.id !== annotationId);
      newAnnotations.set(imageKey, filtered);
      return { ...state, imageAnnotations: newAnnotations };
    }

    case 'CLEAR_IMAGE_ANNOTATIONS': {
      const { imageKey } = action.payload;
      const newAnnotations = new Map(state.imageAnnotations);
      newAnnotations.delete(imageKey);
      return { ...state, imageAnnotations: newAnnotations };
    }

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
  // Annotation helpers
  setImageAnnotations: (imageKey: string, annotations: ManualAnnotation[]) => void;
  addAnnotation: (imageKey: string, annotation: ManualAnnotation) => void;
  updateAnnotation: (imageKey: string, annotationId: string, updates: Partial<ManualAnnotation>) => void;
  deleteAnnotation: (imageKey: string, annotationId: string) => void;
  clearAnnotations: (imageKey: string) => void;
  getAnnotations: (imageKey: string) => ManualAnnotation[];
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
    const resuming = state.isStreamPaused;
    dispatch({ type: 'SET_PAUSED', payload: !state.isStreamPaused });

    // When resuming, trim queue back to limit and jump to newest
    if (resuming && state.batchQueue.length > 0) {
      dispatch({ type: 'TRIM_AND_RESUME' });
    }
  }, [state.isStreamPaused, state.batchQueue.length]);

  const handleSocketData = useCallback((data: SocketInspectionData) => {
    // Just process the message - batch will be added via callback when complete
    processSocketData(data);
  }, []);

  // Annotation helper functions
  const setImageAnnotations = useCallback((imageKey: string, annotations: ManualAnnotation[]) => {
    dispatch({ type: 'SET_IMAGE_ANNOTATIONS', payload: { imageKey, annotations } });
  }, []);

  const addAnnotation = useCallback((imageKey: string, annotation: ManualAnnotation) => {
    dispatch({ type: 'ADD_IMAGE_ANNOTATION', payload: { imageKey, annotation } });
  }, []);

  const updateAnnotation = useCallback((imageKey: string, annotationId: string, updates: Partial<ManualAnnotation>) => {
    dispatch({ type: 'UPDATE_IMAGE_ANNOTATION', payload: { imageKey, annotationId, updates } });
  }, []);

  const deleteAnnotation = useCallback((imageKey: string, annotationId: string) => {
    dispatch({ type: 'DELETE_IMAGE_ANNOTATION', payload: { imageKey, annotationId } });
  }, []);

  const clearAnnotations = useCallback((imageKey: string) => {
    dispatch({ type: 'CLEAR_IMAGE_ANNOTATIONS', payload: { imageKey } });
  }, []);

  const getAnnotations = useCallback((imageKey: string): ManualAnnotation[] => {
    return state.imageAnnotations.get(imageKey) || [];
  }, [state.imageAnnotations]);

  const value: AppContextValue = {
    state,
    dispatch,
    togglePause,
    handleSocketData,
    getCollectionCount,
    setImageAnnotations,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    clearAnnotations,
    getAnnotations,
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
