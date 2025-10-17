import { SocketInspectionData, InspectionBatch, ROIImage, BoundingBox } from '@/types';

// Batch aggregator - groups cameras by inspection/batch ID
class BatchAggregator {
  private batches: Map<string, Map<string, any>> = new Map(); // batchId -> cameras
  private batchTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private batchTimestamps: Map<string, number> = new Map();
  private readonly BATCH_TIMEOUT_MS = 1000; // 1000ms window to group cameras into a batch
  private completedBatches: Set<string> = new Set();
  private currentFallbackBatchId: string | null = null;
  private lastMessageTime: number = 0;
  private onBatchComplete: ((batch: InspectionBatch) => void) | null = null;

  setOnBatchComplete(callback: (batch: InspectionBatch) => void) {
    this.onBatchComplete = callback;
  }

  processMessage(data: any): void {
    // Extract camera ID from the message
    const camId = data.camera_details?.cam_id || data.camera_details?.original_cam_id || data.img || 'Unknown';

    if (!camId) {
      console.warn('[BatchProcessor] No camera ID found in message:', data);
      return;
    }

    // Extract batch/inspection ID from the message
    // Try multiple possible field names
    console.log('[BatchProcessor] 🔍 Looking for batch ID in data. Keys:', Object.keys(data));
    console.log('[BatchProcessor] 🔍 Checking fields - batch_id:', data.batch_id, 'inspection_id:', data.inspection_id, 'run_id:', data.run_id, 'id:', data.id, 'batch:', data.batch);

    let messageBatchId =
      data.batch_id ||
      data.inspection_id ||
      data.run_id ||
      // data.id ||  // REMOVED - this is camera-specific ID, not batch ID!
      data.batch;

    // If no batch ID in data, use time-based fallback
    if (!messageBatchId) {
      const now = Date.now();
      const timeSinceLastMessage = now - this.lastMessageTime;

      console.log(`[BatchProcessor] No batch ID in data. Time since last message: ${timeSinceLastMessage}ms, Timeout threshold: ${this.BATCH_TIMEOUT_MS}ms`);

      // If more than BATCH_TIMEOUT_MS has passed since last message, start new batch
      if (!this.currentFallbackBatchId || (timeSinceLastMessage > this.BATCH_TIMEOUT_MS)) {
        this.currentFallbackBatchId = `batch_${now}`;
        console.log(`[BatchProcessor] ⭐ Starting new fallback batch: ${this.currentFallbackBatchId} (Reason: ${!this.currentFallbackBatchId ? 'no existing batch' : `${timeSinceLastMessage}ms > ${this.BATCH_TIMEOUT_MS}ms`})`);
      } else {
        console.log(`[BatchProcessor] ✓ Reusing existing batch: ${this.currentFallbackBatchId}`);
      }

      messageBatchId = this.currentFallbackBatchId;
      this.lastMessageTime = now;
    }

    console.log(`[BatchProcessor] 📥 Processing camera ${camId} for batch ${messageBatchId}`);

    // Initialize batch if it doesn't exist
    if (!this.batches.has(messageBatchId)) {
      this.batches.set(messageBatchId, new Map());
      this.batchTimestamps.set(messageBatchId, Date.now());
      console.log(`[BatchProcessor] New batch started: ${messageBatchId}`);
    }

    // Get the batch
    const batch = this.batches.get(messageBatchId)!;

    // Store this camera's data if not already present
    if (!batch.has(camId)) {
      batch.set(camId, data);
      console.log(`[BatchProcessor] Camera ${camId} added to batch ${messageBatchId} (${batch.size} cameras total)`);
    }

    // Clear existing timeout for this batch
    if (this.batchTimeouts.has(messageBatchId)) {
      console.log(`[BatchProcessor] ⏱️ Clearing existing timeout for batch ${messageBatchId}`);
      clearTimeout(this.batchTimeouts.get(messageBatchId));
    }

    // Set timeout to finalize this batch
    console.log(`[BatchProcessor] ⏰ Setting ${this.BATCH_TIMEOUT_MS}ms timeout for batch ${messageBatchId}`);
    const timeout = setTimeout(() => {
      console.log(`[BatchProcessor] 🏁 Timeout fired! Finalizing batch ${messageBatchId} with ${batch.size} cameras`);
      this.completedBatches.add(messageBatchId);
      this.batchTimeouts.delete(messageBatchId);

      // Build and emit the completed batch
      const completedBatch = this.buildBatch(messageBatchId);
      if (this.onBatchComplete && completedBatch) {
        console.log(`[BatchProcessor] 📤 Emitting completed batch ${messageBatchId} to callback`);
        this.onBatchComplete(completedBatch);
      } else {
        console.warn(`[BatchProcessor] ⚠️ Cannot emit batch ${messageBatchId} - callback: ${!!this.onBatchComplete}, batch: ${!!completedBatch}`);
      }

      // Clear fallback batch ID if this was a fallback batch
      if (messageBatchId === this.currentFallbackBatchId) {
        console.log(`[BatchProcessor] 🧹 Clearing fallback batch ID`);
        this.currentFallbackBatchId = null;
      }

      // Clean up the batch from memory
      this.batches.delete(messageBatchId);
      this.batchTimestamps.delete(messageBatchId);
    }, this.BATCH_TIMEOUT_MS);

    this.batchTimeouts.set(messageBatchId, timeout);
  }

  private buildBatch(batchId: string): InspectionBatch {
    const rois: ROIImage[] = [];
    const batch = this.batches.get(batchId);

    if (!batch) {
      console.warn(`[BatchProcessor] Batch ${batchId} not found`);
      return this.createEmptyBatch(batchId);
    }

    const batchData = Array.from(batch.entries());
    const timestamp = this.batchTimestamps.get(batchId) || Date.now();

    // Extract model info from first message
    const firstMessage = batchData[0]?.[1] || {};
    console.log('[BatchProcessor] 🔍 First message for model extraction:', {
      keys: Object.keys(firstMessage),
      model: firstMessage.model,
      model_version: firstMessage.model_version,
      version: firstMessage.version,
      model_name: firstMessage.model_name,
      project_id: firstMessage.project_id,
    });
    const model = firstMessage.model || firstMessage.model_name || 'Unknown';
    const version = firstMessage.model_version || firstMessage.version || 'Unknown';
    const project_id = firstMessage.project_id;
    console.log('[BatchProcessor] 📊 Extracted model:', model, 'version:', version, 'project_id:', project_id);

    // Process all cameras dynamically
    let boxNumber = 1;
    for (const [cameraId, cameraData] of batchData) {
      // Try multiple field names for prediction/result
      const prediction = (
        cameraData.prediction ||
        cameraData.result ||
        cameraData.status ||
        (cameraData.detections > 0 ? 'FAIL' : 'PASS') // Infer from detections
      )?.toString().toUpperCase();

      const result: 'PASS' | 'FAIL' | 'UNKNOWN' =
        prediction === 'PASS' || prediction === 'FAIL' ? prediction : 'UNKNOWN';

      // Extract bounding boxes if available
      const boundingBoxes: BoundingBox[] = [];

      console.log(`[BatchProcessor] Checking for bounding boxes in camera ${cameraId}:`, {
        has_bounding_boxes: !!cameraData.bounding_boxes,
        has_boxes: !!cameraData.boxes,
        detections: cameraData.detections,
        dataKeys: Object.keys(cameraData)
      });

      // Extract from 'tags' field (new format)
      if (cameraData.tags && Array.isArray(cameraData.tags)) {
        console.log(`[BatchProcessor] 🏷️ Found ${cameraData.tags.length} tags for ${cameraId}`);
        for (const tagObj of cameraData.tags) {
          console.log(`[BatchProcessor] 🏷️ Tag object:`, tagObj);

          // Skip "no_detections" tags
          if (tagObj.tag === 'no_detections') {
            console.log(`[BatchProcessor] ⏭️ Skipping no_detections tag`);
            continue;
          }

          // Extract box coordinates - the format is [x1, y1, x2, y2] normalized (0-1)
          const boxArray = tagObj.box || [];
          console.log(`[BatchProcessor] 📐 Box array:`, boxArray);

          if (boxArray.length >= 4) {
            // Original coordinates from backend
            const x1_orig = boxArray[0];
            const y1_orig = boxArray[1];
            const x2_orig = boxArray[2];
            const y2_orig = boxArray[3];

            console.log(`[BatchProcessor] 📐 Original coords: x1=${x1_orig}, y1=${y1_orig}, x2=${x2_orig}, y2=${y2_orig}`);

            // Transform: Rotate 90° clockwise, then flip vertically
            // For rotate 90° clockwise: (x, y) -> (y, 1-x)
            // Then flip vertically: (x, y) -> (x, 1-y)
            // Final combined: (x, y) -> (y, x)

            // Apply transformation to both corners
            const x1_transformed = y1_orig;
            const y1_transformed = x1_orig;
            const x2_transformed = y2_orig;
            const y2_transformed = x2_orig;

            // Ensure x1 < x2 and y1 < y2 after transformation
            const x1 = Math.min(x1_transformed, x2_transformed);
            const x2 = Math.max(x1_transformed, x2_transformed);
            const y1 = Math.min(y1_transformed, y2_transformed);
            const y2 = Math.max(y1_transformed, y2_transformed);

            const bbox = {
              x: x1,
              y: y1,
              width: x2 - x1,
              height: y2 - y1,
              label: tagObj.tag,
              confidence: tagObj.score,
              color: tagObj.flag, // Use the flag field for color
            };
            console.log(`[BatchProcessor] 📦 Transformed bbox:`, bbox);
            boundingBoxes.push(bbox);
          }
        }
      }

      // Fallback: try bounding_boxes field (old format)
      else if (cameraData.bounding_boxes && Array.isArray(cameraData.bounding_boxes)) {
        console.log(`[BatchProcessor] Found ${cameraData.bounding_boxes.length} bounding_boxes for ${cameraId}`);
        for (const box of cameraData.bounding_boxes) {
          const bbox = {
            x: box.x || box.x1 || box.left || 0,
            y: box.y || box.y1 || box.top || 0,
            width: box.width || (box.x2 - box.x1) || (box.right - box.left) || 0,
            height: box.height || (box.y2 - box.y1) || (box.bottom - box.top) || 0,
            label: box.label || box.class || box.category,
            confidence: box.confidence || box.score,
          };
          console.log(`[BatchProcessor] Extracted bbox:`, bbox);
          boundingBoxes.push(bbox);
        }
      } else if (cameraData.boxes && Array.isArray(cameraData.boxes)) {
        console.log(`[BatchProcessor] Found ${cameraData.boxes.length} boxes for ${cameraId}`);
        for (const box of cameraData.boxes) {
          const bbox = {
            x: box.x || box.x1 || box.left || 0,
            y: box.y || box.y1 || box.top || 0,
            width: box.width || (box.x2 - box.x1) || (box.right - box.left) || 0,
            height: box.height || (box.y2 - box.y1) || (box.bottom - box.top) || 0,
            label: box.label || box.class || box.category,
            confidence: box.confidence || box.score,
          };
          console.log(`[BatchProcessor] Extracted bbox:`, bbox);
          boundingBoxes.push(bbox);
        }
      }

      console.log(`[BatchProcessor] Total bounding boxes extracted for ${cameraId}: ${boundingBoxes.length}`);

      rois.push({
        boxNumber: boxNumber++,
        cameraId,
        result,
        reason: cameraData.detections !== undefined
          ? `${cameraData.detections} detection${cameraData.detections !== 1 ? 's' : ''}`
          : 'No data',
        imageData: `data:image/jpeg;base64,${cameraData.base64 || cameraData.image || ''}`,
        timestamp,
        batchId,
        detections: boundingBoxes.length > 0 ? boundingBoxes : undefined,
      });
    }

    const inspectionBatch: InspectionBatch = {
      id: batchId,
      timestamp,
      model,
      version,
      project_id,
      overallStatus: this.determineOverallStatus(rois),
      processingTime: 0,
      totalInputs: batch.size,
      rois,
    };

    return inspectionBatch;
  }

  private createEmptyBatch(batchId: string): InspectionBatch {
    return {
      id: batchId,
      timestamp: Date.now(),
      model: 'Unknown',
      version: 'Unknown',
      overallStatus: 'UNKNOWN',
      processingTime: 0,
      totalInputs: 0,
      rois: [],
    };
  }

  private determineOverallStatus(rois: ROIImage[]): 'PASS' | 'FAIL' | 'UNKNOWN' {
    const hasPass = rois.some(roi => roi.result?.toUpperCase() === 'PASS');
    const hasFail = rois.some(roi => roi.result?.toUpperCase() === 'FAIL');

    if (hasFail) return 'FAIL';
    if (hasPass) return 'PASS';
    return 'UNKNOWN';
  }
}

// Create singleton aggregator
const aggregator = new BatchAggregator();

// Set up batch completion callback
export const setBatchCompleteCallback = (callback: (batch: InspectionBatch) => void) => {
  aggregator.setOnBatchComplete(callback);
};

// Main processing function - now just processes messages without returning
export const processSocketData = (data: SocketInspectionData): void => {
  // Check if this is the old format (aggregated batch)
  if (data.results) {
    // Old format - process as before and emit immediately
    const batch = processAggregatedBatch(data);
    aggregator.setOnBatchComplete((cb) => cb);
    if (aggregator['onBatchComplete']) {
      aggregator['onBatchComplete'](batch);
    }
    return;
  }

  // New format - individual camera message
  aggregator.processMessage(data);
};

// Process old-style aggregated batches (if they exist)
function processAggregatedBatch(data: SocketInspectionData): InspectionBatch {
  const timestamp = Date.now();
  const batchId = `batch_${timestamp}`;
  const rois: ROIImage[] = [];

  let boxNumber = 1;
  for (const [cameraId, cameraResult] of Object.entries(data.results || {})) {
    rois.push({
      boxNumber: boxNumber++,
      cameraId,
      result: cameraResult.result || 'UNKNOWN',
      reason: cameraResult.reason || 'No reason provided',
      imageData: cameraResult.image || '',
      timestamp,
      batchId,
    });
  }

  return {
    id: batchId,
    timestamp,
    model: data.model || 'Unknown',
    version: data.version || 'Unknown',
    overallStatus: data.overall_pass_fail || 'UNKNOWN',
    processingTime: data.total_time || 0,
    totalInputs: data.total_inputs || 0,
    rois,
  };
}

// Create a single-camera batch from individual message
function createSingleCameraBatch(data: any): InspectionBatch {
  const timestamp = Date.now();
  const batchId = `batch_${timestamp}`;
  const camId = data.camera_details?.cam_id || data.camera_details?.original_cam_id || data.img || 'Unknown';

  // Try multiple field names for prediction/result
  const prediction = (
    data.prediction ||
    data.result ||
    data.status ||
    (data.detections > 0 ? 'FAIL' : 'PASS') // Infer from detections
  )?.toString().toUpperCase();

  const result: 'PASS' | 'FAIL' | 'UNKNOWN' =
    prediction === 'PASS' || prediction === 'FAIL' ? prediction : 'UNKNOWN';

  // Extract bounding boxes if available
  const boundingBoxes: BoundingBox[] = [];
  if (data.bounding_boxes && Array.isArray(data.bounding_boxes)) {
    for (const box of data.bounding_boxes) {
      boundingBoxes.push({
        x: box.x || box.x1 || box.left || 0,
        y: box.y || box.y1 || box.top || 0,
        width: box.width || (box.x2 - box.x1) || (box.right - box.left) || 0,
        height: box.height || (box.y2 - box.y1) || (box.bottom - box.top) || 0,
        label: box.label || box.class || box.category,
        confidence: box.confidence || box.score,
      });
    }
  } else if (data.boxes && Array.isArray(data.boxes)) {
    for (const box of data.boxes) {
      boundingBoxes.push({
        x: box.x || box.x1 || box.left || 0,
        y: box.y || box.y1 || box.top || 0,
        width: box.width || (box.x2 - box.x1) || (box.right - box.left) || 0,
        height: box.height || (box.y2 - box.y1) || (box.bottom - box.top) || 0,
        label: box.label || box.class || box.category,
        confidence: box.confidence || box.score,
      });
    }
  }

  const rois: ROIImage[] = [{
    boxNumber: 1,
    cameraId: camId,
    result,
    reason: data.detections !== undefined
      ? `${data.detections} detection${data.detections !== 1 ? 's' : ''}`
      : 'No data',
    imageData: `data:image/jpeg;base64,${data.base64 || data.image || ''}`,
    timestamp,
    batchId,
    detections: boundingBoxes.length > 0 ? boundingBoxes : undefined,
  }];

  return {
    id: batchId,
    timestamp,
    model: data.model || 'Unknown',
    version: data.model_version || 'Unknown',
    overallStatus: result,
    processingTime: 0,
    totalInputs: 1,
    rois,
  };
}
