/**
 * Download Service - Handles communication with local file server
 *
 * Provides methods to:
 * - Check if file server is running
 * - Send images for saving to Documents folder
 * - Open saved folder in Explorer
 */

import { CollectedImage } from './collectionStore';

const FILE_SERVER_URL = 'http://localhost:3001';

export interface DownloadProgress {
  total: number;
  completed: number;
  currentFile: string;
  status: 'idle' | 'preparing' | 'downloading' | 'complete' | 'error';
  error?: string;
}

export interface SaveResult {
  success: boolean;
  message: string;
  sessionPath?: string;
  savedCount?: number;
  failedCount?: number;
  errors?: string[];
}

/**
 * Check if the local file server is running
 */
export const checkFileServerHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${FILE_SERVER_URL}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Generate filename for an image
 * Format: {tag}_{cameraId}_{timestamp}.jpg
 * For random samples: random_{tag}_{cameraId}_{timestamp}.jpg
 */
const generateFilename = (image: CollectedImage): string => {
  const sanitize = (str: string) => str.replace(/[<>:"/\\|?*]/g, '_');
  const tag = sanitize(image.tag || 'untagged');
  const camera = sanitize(image.cameraId || 'unknown');
  const timestamp = image.timestamp || Date.now();
  const prefix = image.isRandomSample ? 'random_' : '';
  return `${prefix}${tag}_${camera}_${timestamp}.jpg`;
};

/**
 * Determine the subfolder for an image
 * Random samples go to "random_samples" folder
 * Regular images go to their tag folder
 */
const getSubfolder = (image: CollectedImage): string => {
  if (image.isRandomSample) {
    return 'random_samples';
  }
  const sanitize = (str: string) => str.replace(/[<>:"/\\|?*]/g, '_');
  return sanitize(image.tag || 'untagged');
};

/**
 * Save images to the local filesystem via file server
 */
export const saveImages = async (
  images: CollectedImage[],
  onProgress?: (progress: DownloadProgress) => void
): Promise<SaveResult> => {
  // Check server health first
  const isHealthy = await checkFileServerHealth();
  if (!isHealthy) {
    return {
      success: false,
      message: 'File server is not running. Please start it with: npm run file-server',
    };
  }

  onProgress?.({
    total: images.length,
    completed: 0,
    currentFile: 'Preparing...',
    status: 'preparing',
  });

  // Prepare image data for server
  const imagePayload = images.map((img, index) => {
    onProgress?.({
      total: images.length,
      completed: index,
      currentFile: `Preparing ${img.tag}...`,
      status: 'preparing',
    });

    return {
      tag: img.tag,
      subfolder: getSubfolder(img),
      filename: generateFilename(img),
      base64: img.imageData,
      cameraId: img.cameraId,
      timestamp: img.timestamp,
      result: img.result,
      isRandomSample: img.isRandomSample || false,
    };
  });

  onProgress?.({
    total: images.length,
    completed: 0,
    currentFile: 'Sending to file server...',
    status: 'downloading',
  });

  try {
    const response = await fetch(`${FILE_SERVER_URL}/api/save-images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ images: imagePayload }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      onProgress?.({
        total: images.length,
        completed: images.length,
        currentFile: 'Complete!',
        status: 'complete',
      });

      return {
        success: true,
        message: result.message,
        sessionPath: result.sessionPath,
        savedCount: result.results?.success || images.length,
        failedCount: result.results?.failed || 0,
        errors: result.results?.errors,
      };
    } else {
      onProgress?.({
        total: images.length,
        completed: 0,
        currentFile: '',
        status: 'error',
        error: result.error || 'Unknown error',
      });

      return {
        success: false,
        message: result.error || 'Failed to save images',
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    onProgress?.({
      total: images.length,
      completed: 0,
      currentFile: '',
      status: 'error',
      error: errorMessage,
    });

    return {
      success: false,
      message: `Failed to connect to file server: ${errorMessage}`,
    };
  }
};

/**
 * Open the saved folder in Windows Explorer (or native file browser)
 */
export const openFolder = async (folderPath?: string): Promise<boolean> => {
  try {
    const response = await fetch(`${FILE_SERVER_URL}/api/open-folder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ folderPath }),
    });

    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Get the base documents path from the server
 */
export const getDocumentsPath = async (): Promise<string | null> => {
  try {
    const response = await fetch(`${FILE_SERVER_URL}/api/health`);
    const data = await response.json();
    return data.documentsPath || null;
  } catch {
    return null;
  }
};
