/**
 * Collection Store - Manages accumulated images from WebSocket for download
 *
 * Images are stored in memory, grouped by their dominant tag.
 * Provides statistics and retrieval methods for the Collection Manager UI.
 * Supports random sampling for unbiased dataset collection.
 */

import { ROIImage, BoundingBox } from '@/types';

export interface CollectedImage {
  id: string; // Unique identifier: `${batchId}_${boxNumber}_${timestamp}`
  tag: string; // Dominant tag (most detections)
  cameraId: string;
  timestamp: number;
  result: 'PASS' | 'FAIL' | 'UNKNOWN';
  imageData: string; // Base64 encoded
  batchId: string;
  boxNumber: number;
  allTags: string[]; // All detected tags
  detections?: BoundingBox[];
  isRandomSample?: boolean; // True if this was selected via random sampling
}

export interface TagStats {
  tag: string;
  count: number;
  passCount: number;
  failCount: number;
  thumbnail: string | null; // First image as preview
  color?: string; // Tag color if available
  target?: number; // User-defined collection target
  targetDelta?: number; // How many more samples needed to reach target
}

export interface RandomSamplingConfig {
  enabled: boolean;
  rate: number; // 1 in N images (e.g., 100 means 1 in 100)
  target: number; // Target number of random samples to collect
}

export interface RandomSamplingStats {
  collected: number;
  target: number;
  totalProcessed: number;
  rate: number;
}

// Class balance targets from analytics
let classBalanceTargets: Record<string, number> = {}; // tag -> targetDelta
let medianClassCount: number = 0;

// User-defined collection targets per tag
let collectionTargets: Record<string, number> = {};

// Random sampling state
let randomSamplingConfig: RandomSamplingConfig = {
  enabled: false,
  rate: 100, // Default: 1 in 100
  target: 100, // Default target: 100 random samples
};
let randomSampleCount: number = 0;
let totalImagesProcessed: number = 0;

export type ResultFilter = 'all' | 'fail' | 'pass';
export type SortMode = 'rarest' | 'most-needed' | 'alphabetical' | 'count';

// In-memory store
let collectedImages: Map<string, CollectedImage> = new Map();
let randomSamples: Map<string, CollectedImage> = new Map(); // Separate store for random samples
let tagColors: Record<string, string> = {};

/**
 * Set tag colors from the app context
 */
export const setTagColors = (colors: Record<string, string>) => {
  tagColors = colors;
};

/**
 * Set class balance targets from analytics data
 * This tells us how many samples of each tag are needed
 */
export const setClassBalanceTargets = (
  targets: Record<string, number>,
  median: number
) => {
  classBalanceTargets = targets;
  medianClassCount = median;
};

/**
 * Get the current median class count target
 */
export const getMedianClassCount = (): number => {
  return medianClassCount;
};

// ============================================
// Collection Targets Management
// ============================================

/**
 * Set collection target for a specific tag
 */
export const setCollectionTarget = (tag: string, target: number): void => {
  collectionTargets[tag] = target;
};

/**
 * Set collection targets for multiple tags at once
 */
export const setCollectionTargets = (targets: Record<string, number>): void => {
  collectionTargets = { ...collectionTargets, ...targets };
};

/**
 * Set the same target for all tags
 */
export const setUniformTarget = (target: number): void => {
  const stats = getTagStats('all');
  for (const stat of stats) {
    collectionTargets[stat.tag] = target;
  }
};

/**
 * Set target for tags below a count threshold (rare tags)
 */
export const setTargetForRareTags = (target: number, threshold: number): void => {
  const stats = getTagStats('all');
  for (const stat of stats) {
    if (stat.count < threshold) {
      collectionTargets[stat.tag] = target;
    }
  }
};

/**
 * Get collection target for a tag
 */
export const getCollectionTarget = (tag: string): number | undefined => {
  return collectionTargets[tag];
};

/**
 * Get all collection targets
 */
export const getAllCollectionTargets = (): Record<string, number> => {
  return { ...collectionTargets };
};

/**
 * Clear all collection targets
 */
export const clearCollectionTargets = (): void => {
  collectionTargets = {};
};

// ============================================
// Random Sampling Management
// ============================================

/**
 * Configure random sampling
 */
export const configureRandomSampling = (config: Partial<RandomSamplingConfig>): void => {
  randomSamplingConfig = { ...randomSamplingConfig, ...config };
};

/**
 * Get current random sampling configuration
 */
export const getRandomSamplingConfig = (): RandomSamplingConfig => {
  return { ...randomSamplingConfig };
};

/**
 * Get random sampling statistics
 */
export const getRandomSamplingStats = (): RandomSamplingStats => {
  return {
    collected: randomSamples.size,
    target: randomSamplingConfig.target,
    totalProcessed: totalImagesProcessed,
    rate: randomSamplingConfig.rate,
  };
};

/**
 * Check if an image should be randomly sampled
 */
const shouldRandomSample = (): boolean => {
  if (!randomSamplingConfig.enabled) return false;
  if (randomSamples.size >= randomSamplingConfig.target) return false;

  // Random selection: 1 in N chance
  return Math.random() < (1 / randomSamplingConfig.rate);
};

/**
 * Get all random samples
 */
export const getRandomSamples = (): CollectedImage[] => {
  return Array.from(randomSamples.values()).sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Clear random samples
 */
export const clearRandomSamples = (): void => {
  randomSamples.clear();
  randomSampleCount = 0;
  totalImagesProcessed = 0;
};

/**
 * Generate random samples from existing collection
 * This picks N random images from what's already been collected
 */
export const generateRandomSamplesFromExisting = (
  count: number,
  filter: ResultFilter = 'all'
): CollectedImage[] => {
  // Get all images matching filter
  const allImages: CollectedImage[] = [];
  for (const image of collectedImages.values()) {
    if (filter === 'fail' && image.result !== 'FAIL') continue;
    if (filter === 'pass' && image.result !== 'PASS') continue;
    allImages.push(image);
  }

  if (allImages.length === 0) return [];

  // Fisher-Yates shuffle for true randomness
  const shuffled = [...allImages];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Take first N and mark as random samples
  const samples = shuffled.slice(0, Math.min(count, shuffled.length));
  return samples.map((img) => ({
    ...img,
    id: `random_${img.id}`,
    isRandomSample: true,
  }));
};

/**
 * Calculate class balance targets from collected images
 * Returns how many more of each tag are needed to reach median
 */
export const calculateClassBalanceFromCollection = (): {
  targets: Record<string, number>;
  median: number;
} => {
  const tagCounts: Record<string, number> = {};

  // Count images per tag
  for (const image of collectedImages.values()) {
    tagCounts[image.tag] = (tagCounts[image.tag] || 0) + 1;
  }

  // Calculate median
  const counts = Object.values(tagCounts).sort((a, b) => a - b);
  const median = counts.length > 0 ? counts[Math.floor(counts.length / 2)] : 0;

  // Calculate targets (how many needed to reach median)
  const targets: Record<string, number> = {};
  for (const [tag, count] of Object.entries(tagCounts)) {
    targets[tag] = Math.max(0, median - count);
  }

  return { targets, median };
};

/**
 * Get the dominant tag from detections (most frequent)
 */
const getDominantTag = (detections?: BoundingBox[]): string => {
  if (!detections || detections.length === 0) {
    return 'untagged';
  }

  // Count tag occurrences
  const tagCounts: Record<string, number> = {};
  for (const det of detections) {
    const label = det.label || 'unknown';
    tagCounts[label] = (tagCounts[label] || 0) + 1;
  }

  // Find most frequent
  let maxCount = 0;
  let dominantTag = 'untagged';
  for (const [tag, count] of Object.entries(tagCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantTag = tag;
    }
  }

  return dominantTag;
};

/**
 * Get all unique tags from detections
 */
const getAllTags = (detections?: BoundingBox[]): string[] => {
  if (!detections || detections.length === 0) {
    return [];
  }
  const tags = new Set<string>();
  for (const det of detections) {
    if (det.label) {
      tags.add(det.label);
    }
  }
  return Array.from(tags);
};

/**
 * Add an image to the collection
 */
export const addToCollection = (roi: ROIImage): void => {
  const id = `${roi.batchId}_${roi.boxNumber}_${roi.timestamp}`;

  // Track total images processed for random sampling stats
  totalImagesProcessed++;

  // Skip if already collected
  if (collectedImages.has(id)) {
    return;
  }

  const dominantTag = getDominantTag(roi.detections);
  const allTags = getAllTags(roi.detections);

  const collected: CollectedImage = {
    id,
    tag: dominantTag,
    cameraId: roi.cameraId,
    timestamp: roi.timestamp,
    result: roi.result,
    imageData: roi.imageData,
    batchId: roi.batchId,
    boxNumber: roi.boxNumber,
    allTags,
    detections: roi.detections,
    isRandomSample: false,
  };

  collectedImages.set(id, collected);

  // Check for random sampling (independent of tag-based collection)
  if (shouldRandomSample()) {
    const randomSample: CollectedImage = {
      ...collected,
      id: `random_${id}`,
      isRandomSample: true,
    };
    randomSamples.set(randomSample.id, randomSample);
    randomSampleCount++;
  }
};

/**
 * Add multiple ROIs from a batch to the collection
 */
export const addBatchToCollection = (rois: ROIImage[]): void => {
  for (const roi of rois) {
    addToCollection(roi);
  }
};

/**
 * Get statistics for all tags
 */
export const getTagStats = (filter: ResultFilter = 'all'): TagStats[] => {
  const statsMap: Map<string, TagStats> = new Map();

  for (const image of collectedImages.values()) {
    // Apply filter
    if (filter === 'fail' && image.result !== 'FAIL') continue;
    if (filter === 'pass' && image.result !== 'PASS') continue;

    const existing = statsMap.get(image.tag);
    if (existing) {
      existing.count++;
      if (image.result === 'PASS') existing.passCount++;
      if (image.result === 'FAIL') existing.failCount++;
    } else {
      const target = collectionTargets[image.tag];
      statsMap.set(image.tag, {
        tag: image.tag,
        count: 1,
        passCount: image.result === 'PASS' ? 1 : 0,
        failCount: image.result === 'FAIL' ? 1 : 0,
        thumbnail: image.imageData,
        color: tagColors[image.tag],
        target: target,
        targetDelta: target ? Math.max(0, target - 1) : undefined,
      });
    }
  }

  // Update targetDelta based on current counts and targets
  for (const stat of statsMap.values()) {
    const target = collectionTargets[stat.tag];
    if (target !== undefined) {
      stat.target = target;
      stat.targetDelta = Math.max(0, target - stat.count);
    } else {
      // Fall back to class balance if no explicit target
      if (Object.keys(classBalanceTargets).length > 0) {
        stat.targetDelta = classBalanceTargets[stat.tag] || 0;
      } else if (statsMap.size > 0) {
        // Calculate from median
        const counts = Array.from(statsMap.values()).map((s) => s.count).sort((a, b) => a - b);
        const calculatedMedian = counts[Math.floor(counts.length / 2)] || 0;
        stat.targetDelta = Math.max(0, calculatedMedian - stat.count);
      }
    }
  }

  // Sort by count descending
  return Array.from(statsMap.values()).sort((a, b) => b.count - a.count);
};

/**
 * Get statistics sorted by specified mode
 */
export const getTagStatsSorted = (filter: ResultFilter = 'all', sortMode: SortMode = 'rarest'): TagStats[] => {
  const stats = getTagStats(filter);

  switch (sortMode) {
    case 'rarest':
      // Rarest first (lowest count)
      return stats.sort((a, b) => a.count - b.count);
    case 'most-needed':
      // Most needed first (highest targetDelta)
      return stats.sort((a, b) => (b.targetDelta || 0) - (a.targetDelta || 0));
    case 'alphabetical':
      return stats.sort((a, b) => a.tag.localeCompare(b.tag));
    case 'count':
    default:
      // Most common first (highest count)
      return stats.sort((a, b) => b.count - a.count);
  }
};

/**
 * Get statistics with class balance priority sorting
 * Returns tags that need more samples first
 */
export const getTagStatsForClassBalance = (filter: ResultFilter = 'all'): TagStats[] => {
  const stats = getTagStats(filter);

  // Sort by targetDelta descending (tags needing most samples first)
  return stats.sort((a, b) => (b.targetDelta || 0) - (a.targetDelta || 0));
};

/**
 * Get images for a specific tag
 */
export const getImagesByTag = (
  tag: string,
  filter: ResultFilter = 'all',
  limit?: number
): CollectedImage[] => {
  const images: CollectedImage[] = [];

  for (const image of collectedImages.values()) {
    if (image.tag !== tag) continue;
    if (filter === 'fail' && image.result !== 'FAIL') continue;
    if (filter === 'pass' && image.result !== 'PASS') continue;

    images.push(image);
    if (limit && images.length >= limit) break;
  }

  // Sort by timestamp descending (newest first)
  return images.sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Get images for multiple tags with specified limits
 */
export const getImagesForDownload = (
  selections: Array<{ tag: string; count: number | 'all' }>,
  filter: ResultFilter = 'all'
): CollectedImage[] => {
  const result: CollectedImage[] = [];

  for (const { tag, count } of selections) {
    const limit = count === 'all' ? undefined : count;
    const images = getImagesByTag(tag, filter, limit);
    result.push(...images);
  }

  return result;
};

/**
 * Get images to download based on collection targets
 * Downloads up to target amount for each tag that has a target set
 */
export const getImagesForTargetDownload = (
  filter: ResultFilter = 'all'
): CollectedImage[] => {
  const result: CollectedImage[] = [];
  const stats = getTagStats(filter);

  for (const stat of stats) {
    if (stat.target && stat.target > 0) {
      // Download up to target amount
      const images = getImagesByTag(stat.tag, filter, stat.target);
      result.push(...images);
    }
  }

  return result;
};

/**
 * Get total count of collected images
 */
export const getTotalCount = (filter: ResultFilter = 'all'): number => {
  if (filter === 'all') {
    return collectedImages.size;
  }

  let count = 0;
  for (const image of collectedImages.values()) {
    if (filter === 'fail' && image.result === 'FAIL') count++;
    if (filter === 'pass' && image.result === 'PASS') count++;
  }
  return count;
};

/**
 * Clear all collected images
 */
export const clearCollection = (): void => {
  collectedImages.clear();
};

/**
 * Clear everything (images, random samples, targets)
 */
export const clearAll = (): void => {
  collectedImages.clear();
  randomSamples.clear();
  collectionTargets = {};
  randomSampleCount = 0;
  totalImagesProcessed = 0;
};

/**
 * Export collection data for debugging
 */
export const exportCollectionData = (): CollectedImage[] => {
  return Array.from(collectedImages.values());
};

/**
 * Export random samples data
 */
export const exportRandomSamplesData = (): CollectedImage[] => {
  return Array.from(randomSamples.values());
};
