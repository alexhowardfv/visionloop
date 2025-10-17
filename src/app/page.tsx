'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { AppProvider, useAppContext } from '@/contexts/AppContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useNotification } from '@/hooks/useNotification';
import { getAPIClient } from '@/lib/api';
import { generateImageName, extractOriginalName } from '@/lib/imageNaming';
import { Header } from '@/components/Header';
import { ImageGrid } from '@/components/ImageGrid';
import { BatchCarousel } from '@/components/BatchCarousel';
import { Sidebar } from '@/components/Sidebar';
import { Footer } from '@/components/Footer';
import { ImageReviewModal } from '@/components/ImageReviewModal';
import { Notification } from '@/components/Notification';
import { SettingsModal } from '@/components/SettingsModal';
import { DataInspector } from '@/components/DataInspector';
import { LoginPinpad } from '@/components/LoginPinpad';
import { SelectedImage, AddToProjectPayload } from '@/types';
import { setAuthToken, getStoredAuthToken, clearAuthToken } from '@/lib/api';

function VisionLoopApp() {
  const { state, dispatch, togglePause, handleSocketData } = useAppContext();
  const { notification, showNotification, hideNotification } = useNotification();
  const [fps, setFps] = useState(0);
  const [lastBatchTime, setLastBatchTime] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDataInspectorOpen, setIsDataInspectorOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [capturedData, setCapturedData] = useState<any[]>([]);
  const [hasShownConnectNotification, setHasShownConnectNotification] = useState(false);
  // Initialize with empty values - user must configure in settings
  const [socketHost, setSocketHost] = useState('');
  const [socketPort, setSocketPort] = useState('');

  // Load settings from localStorage after component mounts (client-side only)
  useEffect(() => {
    const savedHost = localStorage.getItem('socketHost');
    const savedPort = localStorage.getItem('socketPort');

    // If no settings saved, open settings modal on first load
    if (!savedHost || !savedPort) {
      setIsSettingsOpen(true);
    } else {
      setSocketHost(savedHost);
      setSocketPort(savedPort);
    }
  }, []);

  // Check for stored auth token on mount
  useEffect(() => {
    const storedToken = getStoredAuthToken();
    if (storedToken) {
      setIsAuthenticated(true);
    }
  }, []);

  // WebSocket connection - NO NOTIFICATIONS AT ALL
  const { isConnected } = useWebSocket({
    onMessage: (data) => {
      // Capture raw data for inspection
      const timestampedData = { ...data, _timestamp: Date.now() };
      setCapturedData((prev) => [...prev, timestampedData]);
      console.log('[Data Capture] Received:', timestampedData);

      // Process data normally
      handleSocketData(data);
    },
    onConnectionChange: (connected) => {
      dispatch({ type: 'SET_CONNECTED', payload: connected });
      // No notifications - connection status visible in header only
    },
    socketHost,
    socketPort,
  });

  // Calculate FPS
  useEffect(() => {
    if (state.currentBatch) {
      const now = Date.now();
      if (lastBatchTime > 0) {
        const timeDiff = (now - lastBatchTime) / 1000; // seconds
        const currentFps = timeDiff > 0 ? 1 / timeDiff : 0;
        setFps(currentFps);
      }
      setLastBatchTime(now);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentBatch]);

  // Fetch available tags dynamically based on current batch's model and version
  const [lastFetchedTags, setLastFetchedTags] = useState({ model: '', version: '' });

  useEffect(() => {
    const fetchTags = async () => {
      // Get model and version from the current batch - don't use mock modelInfo
      const model = state.currentBatch?.model;
      const version = state.currentBatch?.version;

      // Only fetch if we have actual batch data
      if (!model || !version) {
        console.log('[App] No batch data yet, skipping tag fetch');
        return;
      }

      // Only fetch if model or version actually changed
      if (model === lastFetchedTags.model && version === lastFetchedTags.version) {
        return;
      }

      try {
        const apiClient = getAPIClient();
        console.log(`[App] Fetching tags for model: ${model}, version: ${version}`);
        const { tags, colors } = await apiClient.getTags(model, version);
        dispatch({ type: 'SET_AVAILABLE_TAGS', payload: tags });
        dispatch({ type: 'SET_TAG_COLORS', payload: colors });
        setLastFetchedTags({ model, version });
      } catch (error) {
        console.error('Failed to fetch tags:', error);
        // Don't show notification on error - tags will fall back to empty
      }
    };

    fetchTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentBatch?.model, state.currentBatch?.version]);

  // Handle image selection toggle
  const handleToggleSelection = useCallback(
    (batchId: string, boxNumber: number) => {
      dispatch({ type: 'TOGGLE_IMAGE_SELECTION', payload: { batchId, boxNumber } });
    },
    [dispatch]
  );

  // Handle tag toggle
  const handleToggleTag = useCallback(
    (tag: string) => {
      dispatch({ type: 'TOGGLE_TAG', payload: tag });
    },
    [dispatch]
  );

  // Handle multi-tag mode toggle
  const handleToggleMultiMode = useCallback(
    (enabled: boolean) => {
      dispatch({ type: 'SET_MULTI_TAG_MODE', payload: enabled });
    },
    [dispatch]
  );

  // Handle review modal open
  const handleOpenReview = useCallback(() => {
    dispatch({ type: 'SET_REVIEW_MODAL_OPEN', payload: true });
  }, [dispatch]);

  // Handle review modal close
  const handleCloseReview = useCallback(() => {
    dispatch({ type: 'SET_REVIEW_MODAL_OPEN', payload: false });
  }, [dispatch]);

  // Handle review carousel navigation
  const handleReviewNext = useCallback(() => {
    const selectedArray = Array.from(state.selectedImages.values());
    if (state.reviewCarouselIndex < selectedArray.length - 1) {
      dispatch({
        type: 'SET_REVIEW_CAROUSEL_INDEX',
        payload: state.reviewCarouselIndex + 1,
      });
    }
  }, [state.reviewCarouselIndex, state.selectedImages, dispatch]);

  const handleReviewPrevious = useCallback(() => {
    if (state.reviewCarouselIndex > 0) {
      dispatch({
        type: 'SET_REVIEW_CAROUSEL_INDEX',
        payload: state.reviewCarouselIndex - 1,
      });
    }
  }, [state.reviewCarouselIndex, dispatch]);

  // Handle remove image from selection
  const handleRemoveImage = useCallback(
    (imageKey: string) => {
      dispatch({ type: 'REMOVE_SELECTED_IMAGE', payload: imageKey });
      showNotification('Image removed from selection', 'info');
    },
    [dispatch, showNotification]
  );

  // Handle add image to project (single image from review modal)
  const handleAddToProject = useCallback(
    async (image: SelectedImage, tags: string[]) => {
      try {
        const apiClient = getAPIClient();

        const originalName = extractOriginalName(image);
        const fileName = generateImageName(tags, originalName, image.cameraId);

        // Get project_id from the batch that the image belongs to
        const imageBatch = state.batchQueue.find(batch => batch.id === image.batchId);
        const projectId = imageBatch?.project_id;

        if (!projectId) {
          throw new Error('No project ID found in batch data. Cannot upload image.');
        }

        console.log('[Upload] Using project UUID from batch:', projectId);

        const result = await apiClient.uploadImageToProject(
          projectId,
          image.imageData,
          fileName
        );

        if (result.id) {
          const modelName = imageBatch?.model || 'project';
          showNotification(
            `Successfully added 1 image to ${modelName} project`,
            'success'
          );

          // Remove from selection
          const imageKey = `${image.batchId}_${image.boxNumber}`;
          dispatch({ type: 'REMOVE_SELECTED_IMAGE', payload: imageKey });
        } else {
          throw new Error('Failed to add image to project');
        }
      } catch (error) {
        console.error('Error adding to project:', error);
        showNotification('Failed to add image to project', 'error');
        throw error;
      }
    },
    [state.batchQueue, dispatch, showNotification]
  );

  // Handle add all selected images to project (from sidebar button)
  const handleAddAllSelectedToProject = useCallback(async () => {
    if (state.selectedImages.size === 0) {
      showNotification('No images selected', 'info');
      return;
    }

    if (state.selectedTags.length === 0) {
      showNotification('Please select at least one tag before adding to project', 'error');
      return;
    }

    try {
      const apiClient = getAPIClient();
      const selectedArray = Array.from(state.selectedImages.values());

      // Get project_id from the current batch (assuming all selected images are from current batch)
      const projectId = state.currentBatch?.project_id;

      if (!projectId) {
        showNotification('No project ID found in batch data. Cannot upload images.', 'error');
        return;
      }

      console.log('[Batch Upload] Using project UUID from batch:', projectId);
      console.log('[Batch Upload] Uploading', selectedArray.length, 'images');

      let successCount = 0;
      let failCount = 0;

      // Upload each image individually
      for (const image of selectedArray) {
        try {
          const originalName = extractOriginalName(image);
          const fileName = generateImageName(state.selectedTags, originalName, image.cameraId);

          await apiClient.uploadImageToProject(
            projectId,
            image.imageData,
            fileName
          );

          successCount++;
        } catch (error) {
          console.error(`Error uploading image ${image.boxNumber}:`, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        const modelName = state.currentBatch?.model || 'project';
        const imageWord = successCount === 1 ? 'image' : 'images';
        showNotification(
          `Successfully added ${successCount} ${imageWord} to ${modelName} project${failCount > 0 ? ` (${failCount} failed)` : ''}`,
          failCount > 0 ? 'info' : 'success'
        );

        // Clear all selections
        dispatch({ type: 'CLEAR_SELECTIONS' });
      } else {
        throw new Error('Failed to add any images to project');
      }
    } catch (error) {
      console.error('Error adding to project:', error);
      showNotification('Failed to add images to project', 'error');
    }
  }, [state.selectedImages, state.selectedTags, state.currentBatch, dispatch, showNotification]);

  // Handle batch carousel navigation
  const handleBatchNavigate = useCallback(
    (index: number) => {
      dispatch({ type: 'SET_QUEUE_INDEX', payload: index });
    },
    [dispatch]
  );

  // Prepare selected images array for review modal
  const selectedImagesArray = useMemo(
    () => Array.from(state.selectedImages.values()),
    [state.selectedImages]
  );

  // Handle settings modal
  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleSaveSettings = useCallback((host: string, port: string) => {
    // Validate inputs
    if (!host || !port) {
      showNotification('Please enter both host and port', 'error');
      return;
    }

    // Check if host changed - if so, clear everything
    const hostChanged = host !== socketHost;

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('socketHost', host);
      localStorage.setItem('socketPort', port);
    }
    setSocketHost(host);
    setSocketPort(port);

    if (hostChanged) {
      // Clear ALL application state when changing servers
      clearAuthToken();
      setIsAuthenticated(false);
      setUserId(''); // Clear user ID

      // Clear all selections and tags
      dispatch({ type: 'CLEAR_SELECTIONS' });

      // Clear batch queue and image cards
      dispatch({ type: 'CLEAR_BATCH_QUEUE' });

      // Clear captured data
      setCapturedData([]);

      // Reset review modal state
      dispatch({ type: 'SET_REVIEW_MODAL_OPEN', payload: false });
      dispatch({ type: 'SET_REVIEW_CAROUSEL_INDEX', payload: 0 });

      // Clear available tags
      dispatch({ type: 'SET_AVAILABLE_TAGS', payload: [] });
      dispatch({ type: 'SET_TAG_COLORS', payload: {} });

      console.log('[Settings] Server changed - cleared all application state');
      showNotification('Server changed. All data cleared. Please log in again.', 'info');
    } else {
      showNotification('Settings saved! Reconnecting...', 'success');
    }
  }, [socketHost, dispatch, showNotification]);

  // Handle data inspector modal
  const handleOpenDataInspector = useCallback(() => {
    setIsDataInspectorOpen(true);
  }, []);

  const handleCloseDataInspector = useCallback(() => {
    setIsDataInspectorOpen(false);
  }, []);

  const handleClearCapturedData = useCallback(() => {
    setCapturedData([]);
    showNotification('Captured data cleared', 'info');
  }, [showNotification]);

  // Handle login modal
  const handleOpenLogin = useCallback(() => {
    setIsLoginOpen(true);
  }, []);

  const handleCloseLogin = useCallback(() => {
    setIsLoginOpen(false);
  }, []);

  const handleLoginSuccess = useCallback((token: string) => {
    setAuthToken(token);
    setIsAuthenticated(true);

    // Get the userId from the API client
    const apiClient = getAPIClient();
    const loggedInUserId = apiClient.getUserId();
    setUserId(loggedInUserId);

    showNotification('Successfully logged in', 'success');
  }, [showNotification]);

  return (
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <Header
        isConnected={state.isConnected}
        isPaused={state.isStreamPaused}
        onTogglePause={togglePause}
        overallStatus={state.currentBatch?.overallStatus || 'UNKNOWN'}
        onOpenSettings={handleOpenSettings}
        onOpenDataInspector={handleOpenDataInspector}
        capturedDataCount={capturedData.length}
        onOpenLogin={handleOpenLogin}
        isAuthenticated={isAuthenticated}
      />

      {/* Main Content Area */}
      <main className="pt-16 pb-12 pr-80">
        {/* Batch Carousel (only visible when paused) */}
        <BatchCarousel
          batchQueue={state.batchQueue}
          currentIndex={state.queueIndex}
          onNavigate={handleBatchNavigate}
          isVisible={state.isStreamPaused}
        />

        {/* Image Grid */}
        {state.currentBatch ? (
          <ImageGrid
            rois={state.currentBatch.rois}
            selectedImages={state.selectedImages}
            onToggleSelection={handleToggleSelection}
            cameraFilter={state.cameraFilter}
          />
        ) : (
          <div className="flex items-center justify-center h-[calc(100vh-112px)]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-text-secondary text-lg">Waiting for inspection data...</p>
              <p className="text-text-muted text-sm mt-2">
                {state.isConnected ? 'Connected to server' : 'Connecting to server...'}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Sidebar */}
      <Sidebar
        selectedCount={state.selectedImages.size}
        availableTags={state.availableTags}
        tagColors={state.tagColors}
        selectedTags={state.selectedTags}
        multiTagMode={state.multiTagMode}
        onToggleTag={handleToggleTag}
        onToggleMultiMode={handleToggleMultiMode}
        onOpenReview={handleOpenReview}
        onAddToProject={handleAddAllSelectedToProject}
      />

      {/* Footer */}
      <Footer
        lastUpdateTime={state.currentBatch?.timestamp || 0}
        queueLength={state.batchQueue.length}
        fps={fps}
        socketHost={socketHost}
        socketPort={socketPort}
        model={state.currentBatch?.model || 'No Data'}
        version={state.currentBatch?.version || 'No Data'}
        userId={userId}
      />

      {/* Image Review Modal */}
      <ImageReviewModal
        isOpen={state.isReviewModalOpen}
        selectedImages={selectedImagesArray}
        currentIndex={state.reviewCarouselIndex}
        onClose={handleCloseReview}
        onNext={handleReviewNext}
        onPrevious={handleReviewPrevious}
        onRemoveImage={handleRemoveImage}
        onAddToProject={handleAddToProject}
        availableTags={state.availableTags}
        tagColors={state.tagColors}
        batchQueue={state.batchQueue}
      />

      {/* Notification Toast */}
      <Notification
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        currentHost={socketHost}
        currentPort={socketPort}
        onSave={handleSaveSettings}
      />

      {/* Data Inspector Modal */}
      <DataInspector
        isOpen={isDataInspectorOpen}
        onClose={handleCloseDataInspector}
        capturedData={capturedData}
        onClearData={handleClearCapturedData}
      />

      {/* Login Pinpad Modal */}
      <LoginPinpad
        isOpen={isLoginOpen}
        onClose={handleCloseLogin}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <VisionLoopApp />
    </AppProvider>
  );
}
