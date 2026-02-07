import { InspectionBatch, ROIImage, BoundingBox } from '@/types';
import { CAMERA_MAP } from '@/lib/constants';

export interface MockConfig {
  cameraCount: number;       // How many cameras per batch (1-34)
  failRate: number;          // 0-1, probability of FAIL per camera
  includeDetections: boolean;
  model: string;
  version: string;
}

const DEFAULT_CONFIG: MockConfig = {
  cameraCount: 8,
  failRate: 0.3,
  includeDetections: true,
  model: 'MockModel',
  version: '1.0.0',
};

const MOCK_LABELS = ['defect', 'crack', 'scratch', 'dent', 'missing_pin'];
const MOCK_COLORS = ['#ef4444', '#f59e0b', '#a74444', '#3b82f6', '#8b5cf6'];

/** Returns mock tags and tag-color map for use when mock data is active */
export function getMockTagsAndColors(): { tags: string[]; colors: Record<string, string> } {
  const colors: Record<string, string> = {};
  MOCK_LABELS.forEach((label, i) => {
    colors[label] = MOCK_COLORS[i];
  });
  return { tags: [...MOCK_LABELS], colors };
}

function generatePlaceholderImage(
  cameraId: string,
  result: 'PASS' | 'FAIL',
  width = 640,
  height = 480
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Background gradient based on result
  const grad = ctx.createLinearGradient(0, 0, width, height);
  if (result === 'PASS') {
    grad.addColorStop(0, '#0f1a0f');
    grad.addColorStop(1, '#1a2e1a');
  } else {
    grad.addColorStop(0, '#1a0f0f');
    grad.addColorStop(1, '#2e1a1a');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Grid pattern for visual texture
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Random noise dots
  for (let i = 0; i < 100; i++) {
    const opacity = Math.random() * 0.08;
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    const size = Math.random() * 4 + 1;
    ctx.fillRect(Math.random() * width, Math.random() * height, size, size);
  }

  // Camera label
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cameraId, width / 2, height / 2 - 24);

  // Result badge
  ctx.fillStyle = result === 'PASS' ? '#4ade80' : '#f87171';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(result, width / 2, height / 2 + 16);

  // MOCK label + timestamp
  ctx.fillStyle = 'rgba(136, 136, 136, 0.6)';
  ctx.font = '12px monospace';
  ctx.fillText(`MOCK DATA - ${new Date().toLocaleTimeString()}`, width / 2, height - 16);

  return canvas.toDataURL('image/jpeg', 0.7);
}

function generateMockDetections(count: number): BoundingBox[] {
  const boxes: BoundingBox[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.random() * 0.6 + 0.1;
    const y = Math.random() * 0.6 + 0.1;
    const w = Math.random() * 0.15 + 0.05;
    const h = Math.random() * 0.15 + 0.05;
    const labelIdx = Math.floor(Math.random() * MOCK_LABELS.length);

    boxes.push({
      x,
      y,
      width: Math.min(w, 1 - x),
      height: Math.min(h, 1 - y),
      label: MOCK_LABELS[labelIdx],
      confidence: Math.random() * 0.4 + 0.6,
      color: MOCK_COLORS[labelIdx],
    });
  }
  return boxes;
}

export function generateMockBatch(config: Partial<MockConfig> = {}): InspectionBatch {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const timestamp = Date.now();
  const batchId = `mock_batch_${timestamp}_${Math.random().toString(36).slice(2, 6)}`;

  // Pick random cameras from CAMERA_MAP
  const allEntries = Object.entries(CAMERA_MAP);
  const shuffled = [...allEntries].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(cfg.cameraCount, allEntries.length));

  // failRate applies at the BATCH level: this batch either fails or passes
  const batchFails = Math.random() < cfg.failRate;

  // If batch fails, pick a random number of cameras (at least 1) to be FAIL
  const failingCameraCount = batchFails
    ? Math.floor(Math.random() * selected.length) + 1
    : 0;
  const failingIndices = new Set<number>();
  while (failingIndices.size < failingCameraCount) {
    failingIndices.add(Math.floor(Math.random() * selected.length));
  }

  const rois: ROIImage[] = selected.map(([, cameraId], index) => {
    const isFail = failingIndices.has(index);
    const result: 'PASS' | 'FAIL' = isFail ? 'FAIL' : 'PASS';
    const detectionCount = isFail ? Math.floor(Math.random() * 3) + 1 : 0;
    const detections = isFail && cfg.includeDetections
      ? generateMockDetections(detectionCount)
      : undefined;

    return {
      boxNumber: index + 1,
      cameraId,
      result,
      reason: isFail
        ? `${detectionCount} detection${detectionCount !== 1 ? 's' : ''}`
        : 'No defects',
      imageData: generatePlaceholderImage(cameraId, result),
      timestamp,
      batchId,
      detections,
    };
  });

  return {
    id: batchId,
    timestamp,
    model: cfg.model,
    version: cfg.version,
    project_id: 'mock-project-id',
    overallStatus: batchFails ? 'FAIL' : 'PASS',
    processingTime: Math.random() * 500 + 100,
    totalInputs: rois.length,
    rois,
  };
}
