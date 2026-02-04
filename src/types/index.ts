// Core Data Structures

export interface InspectionBatch {
  id: string; // Generated client-side: `batch_${timestamp}`
  timestamp: number;
  model: string;
  version: string;
  project_id?: string; // UUID from WebSocket data for cloud uploads
  overallStatus: 'PASS' | 'FAIL' | 'UNKNOWN';
  processingTime: number;
  totalInputs: number;
  rois: ROIImage[];
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  confidence?: number;
  color?: string; // Hex color from tag flag field
}

export interface ROIImage {
  boxNumber: number; // 1-34
  cameraId: string; // e.g., 'CAM3_r0_c0'
  result: 'PASS' | 'FAIL' | 'UNKNOWN';
  reason: string;
  imageData: string; // Base64 encoded image: "data:image/jpeg;base64,..."
  timestamp: number;
  batchId: string; // Reference to parent batch
  detections?: BoundingBox[]; // Optional bounding boxes for detections
}

export interface SelectedImage extends ROIImage {
  selected: boolean;
  assignedTags: string[]; // Tags assigned in review modal
}

export interface AppState {
  // Stream control
  isStreamPaused: boolean;
  isConnected: boolean;

  // Batch management
  currentBatch: InspectionBatch | null;
  batchQueue: InspectionBatch[]; // Max 5 batches (FIFO)
  queueIndex: number; // Current position in carousel (0-4)

  // Selection state
  selectedImages: Map<string, SelectedImage>; // Key: `${batchId}_${boxNumber}`

  // Review modal
  isReviewModalOpen: boolean;
  reviewCarouselIndex: number;

  // Tags
  availableTags: string[];
  tagColors: Record<string, string>; // Map of tag name to hex color
  selectedTags: string[]; // Currently selected in sidebar
  multiTagMode: boolean;

  // Config
  modelInfo: {
    name: string;
    version: string;
  };
  cameraFilter: string; // 'all' | 'camera1' | 'camera2' ...
}

export interface TagDefinition {
  id: string;
  name: string;
  displayName: string;
  colorClass: string; // Tailwind class
  hexColor?: string; // Hex color from API (e.g., "#a74444")
}

export interface AddToProjectPayload {
  model: string;
  version: string;
  images: Array<{
    originalName: string;
    newName: string; // Format: {tag}_{originalName}
    cameraId: string;
    batchId: string;
    result: string;
    imageData: string;
  }>;
}

export interface ImageUploadResponse {
  id: string;
  photoId: string;
  expanded: boolean;
  imgUrl: string;
  thumbnail: string;
  modified: number;
  reviewed: boolean;
  name: string;
  project_id: string;
  title: string;
  ETag: string;
  Upload_Etag: string;
  children: any[];
  image_type: string;
  dimensions: {
    height: number;
    width: number;
    size: number;
  };
}

export interface SocketInspectionData {
  overall_pass_fail: 'PASS' | 'FAIL' | 'UNKNOWN';
  total_inputs: number;
  total_time: number;
  model: string;
  version?: string;
  results: {
    [cameraId: string]: {
      result: 'PASS' | 'FAIL';
      reason: string;
      image?: string; // Base64 image data
      fileName?: string; // Original filename
    };
  };
}

// Component Props Types

export interface HeaderProps {
  isConnected: boolean;
  isPaused: boolean;
  onTogglePause: () => void;
  overallStatus: 'PASS' | 'FAIL' | 'UNKNOWN';
}

export interface ImageCardProps {
  roi: ROIImage;
  isSelected: boolean;
  onToggleSelection: () => void;
}

export interface ImageGridProps {
  rois: ROIImage[];
  selectedImages: Map<string, SelectedImage>;
  onToggleSelection: (batchId: string, boxNumber: number) => void;
  cameraFilter: string;
}

export interface BatchCarouselProps {
  batchQueue: InspectionBatch[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  isVisible: boolean;
}

export interface SidebarProps {
  selectedCount: number;
  availableTags: string[];
  tagColors: Record<string, string>; // Map of tag name to hex color
  selectedTags: string[];
  multiTagMode: boolean;
  onToggleTag: (tag: string) => void;
  onToggleMultiMode: (enabled: boolean) => void;
  onOpenReview: () => void;
  onAddToProject: () => void;
}

export interface ImageReviewModalProps {
  isOpen: boolean;
  selectedImages: SelectedImage[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onRemoveImage: (imageKey: string) => void;
  onAddToProject: (image: SelectedImage, tags: string[]) => Promise<void>;
  availableTags: string[];
  tagColors: Record<string, string>;
  batchQueue: InspectionBatch[];
}

export interface NotificationProps {
  message: string;
  type: 'success' | 'error' | 'info';
  isVisible: boolean;
  onClose: () => void;
}

export interface FooterProps {
  lastUpdateTime: number;
  queueLength: number;
  fps: number;
  socketHost: string;
  socketPort: string;
  model: string;
  version: string;
}
