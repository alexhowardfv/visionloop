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

// Manual annotation for user-drawn bounding boxes (matches cloud API format)
export interface ManualAnnotation {
  id: string;                         // Client-side unique ID (for editing/deleting)
  index: number;                      // Sequential index for API
  title: string;                      // Tag name
  tool: 'tagBox';                     // Always 'tagBox' for bounding boxes
  flag?: string;                      // Tag color (hex)
  shape: {
    p1: { x: number; y: number };     // Top-left (normalized 0-1)
    p2: { x: number; y: number };     // Bottom-right (normalized 0-1)
  };
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
  batchQueue: InspectionBatch[]; // FIFO, limited by maxBatchQueue
  queueIndex: number; // Current position in carousel

  // Selection state
  selectedImages: Map<string, SelectedImage>; // Key: `${batchId}_${boxNumber}`

  // Review modal
  isReviewModalOpen: boolean;
  wasPausedBeforeReview: boolean;
  reviewCarouselIndex: number;

  // Tags
  availableTags: string[];
  tagColors: Record<string, string>; // Map of tag name to hex color
  selectedTags: string[]; // Currently selected in sidebar
  multiTagMode: boolean;

  // Image annotations (persists when modal closes)
  imageAnnotations: Map<string, ManualAnnotation[]>; // Key: `${batchId}_${boxNumber}`

  // Config
  maxBatchQueue: number; // User-configurable queue limit (5, 10, or 20)
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
  isPaused: boolean;
  onTogglePause: () => void;
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
  selectedImages?: Map<string, SelectedImage>;
  overallStatus?: 'PASS' | 'FAIL' | 'UNKNOWN';
  maxQueueSize?: number;
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
  onClearSelection: () => void;
}

export interface ImageReviewModalProps {
  isOpen: boolean;
  selectedImages: SelectedImage[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onRemoveImage: (imageKey: string) => void;
  onAddToProject: (image: SelectedImage, tags: string[], annotations: ManualAnnotation[]) => Promise<void>;
  availableTags: string[];
  tagColors: Record<string, string>;
  batchQueue: InspectionBatch[];
  // Annotation state from AppContext
  imageAnnotations: Map<string, ManualAnnotation[]>;
  onSetImageAnnotations: (imageKey: string, annotations: ManualAnnotation[]) => void;
  onAddAnnotation: (imageKey: string, annotation: ManualAnnotation) => void;
  onUpdateAnnotation: (imageKey: string, annotationId: string, updates: Partial<ManualAnnotation>) => void;
  onDeleteAnnotation: (imageKey: string, annotationId: string) => void;
  annotationsEnabled?: boolean;
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
  model: string;
  version: string;
  isConnected: boolean;
}
