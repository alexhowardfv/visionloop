import { ROIImage } from '@/types';

export const generateImageName = (
  tags: string[],
  originalName: string,
  cameraId: string
): string => {
  // If no original name from socket, generate one
  const baseName = originalName || `${cameraId}_${Date.now()}.jpg`;

  // If no tags, return original (with spaces removed)
  if (tags.length === 0) {
    return baseName.replace(/\s+/g, '_');
  }

  // Format: Tag1_Tag2_originalName
  // Replace spaces in tags and base name with underscores
  const tagPrefix = tags.map(tag => tag.replace(/\s+/g, '_')).join('_');
  const cleanBaseName = baseName.replace(/\s+/g, '_');
  return `${tagPrefix}_${cleanBaseName}`;
};

export const extractOriginalName = (roi: ROIImage): string => {
  // Generate filename from camera ID and timestamp
  return `${roi.cameraId}_${roi.timestamp}.jpg`;
};
