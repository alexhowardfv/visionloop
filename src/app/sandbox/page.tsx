'use client';

import React, { useState, useCallback } from 'react';
import { BoundingBox, ManualAnnotation, MarkerConstants, DetectionActionState } from '@/types';

// Lazy load AnnotationLayer to avoid blocking page render
const AnnotationLayer = React.lazy(() =>
  import('@/components/AnnotationLayer').then((mod) => ({ default: mod.AnnotationLayer }))
);

// --- Mock Data ---

const TAG_COLORS: Record<string, string> = {
  scratch: '#ef4444',
  dent: '#f59e0b',
  stain: '#8b5cf6',
  surface_contamination: '#06b6d4',
  OK: '#22c55e',
  crack: '#ec4899',
  misalignment: '#3b82f6',
};

const MOCK_DETECTIONS: BoundingBox[] = [
  { x: 0.05, y: 0.08, width: 0.18, height: 0.14, label: 'scratch', confidence: 0.873, color: '#ef4444' },
  { x: 0.70, y: 0.06, width: 0.25, height: 0.20, label: 'surface_contamination', confidence: 0.641, color: '#06b6d4' },
  { x: 0.30, y: 0.55, width: 0.15, height: 0.12, label: 'dent', confidence: 0.952, color: '#f59e0b' },
  { x: 0.55, y: 0.40, width: 0.12, height: 0.10, label: 'OK', color: '#22c55e' },
];

const INITIAL_ANNOTATIONS: ManualAnnotation[] = [
  {
    id: 'ann_sandbox_1',
    index: 0,
    title: 'crack',
    tool: 'tagBox',
    flag: '#ec4899',
    shape: { p1: { x: 0.05, y: 0.70 }, p2: { x: 0.25, y: 0.90 } },
  },
  {
    id: 'ann_sandbox_2',
    index: 1,
    title: 'misalignment',
    tool: 'tagBox',
    flag: '#3b82f6',
    shape: { p1: { x: 0.50, y: 0.68 }, p2: { x: 0.75, y: 0.85 } },
  },
];

const DEFAULT_CONSTANTS: MarkerConstants = {
  LABEL_HEIGHT: 24,
  LABEL_FONT_SIZE: 13,
  LABEL_CHAR_WIDTH: 8,
  LABEL_PADDING: 10,
  ACTION_BTN_SIZE: 22,
  DETECTION_LABEL_RADIUS: 4,
  ANNOTATION_LABEL_RADIUS: 4,
};

// --- Sandbox Page ---

const IMAGE_WIDTH = 800;
const IMAGE_HEIGHT = 600;

export default function SandboxPage() {
  // Annotation state
  const [annotations, setAnnotations] = useState<ManualAnnotation[]>(INITIAL_ANNOTATIONS);
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);
  const [selectedTagForDrawing, setSelectedTagForDrawing] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  // Visibility
  const [showDetections, setShowDetections] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(true);

  // Marker constants (live tweaking)
  const [markerConstants, setMarkerConstants] = useState<MarkerConstants>({ ...DEFAULT_CONSTANTS });

  // Detection actions (expandable markers)
  const [detectionActions, setDetectionActions] = useState<Map<number, DetectionActionState>>(new Map());

  // Development log panel
  const [showDevLog, setShowDevLog] = useState(false);

  // --- Handlers ---

  const handleAddAnnotation = useCallback((annotation: ManualAnnotation) => {
    setAnnotations((prev) => [...prev, annotation]);
  }, []);

  const handleUpdateAnnotation = useCallback((id: string, updates: Partial<ManualAnnotation>) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setSelectedAnnotationId((prev) => (prev === id ? null : prev));
  }, []);

  const handleSelectAnnotation = useCallback((id: string | null) => {
    setSelectedAnnotationId(id);
  }, []);

  const handleDetectionAction = useCallback((index: number, action: DetectionActionState) => {
    setDetectionActions((prev) => {
      const next = new Map(prev);
      next.set(index, action);
      return next;
    });
  }, []);

  const handleConvertToAnnotation = useCallback((detection: BoundingBox, index: number) => {
    const newAnnotation: ManualAnnotation = {
      id: `ann_conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      index: annotations.length,
      title: detection.label || 'Detection',
      tool: 'tagBox',
      flag: detection.color || '#3b82f6',
      shape: {
        p1: { x: detection.x, y: detection.y },
        p2: { x: detection.x + detection.width, y: detection.y + detection.height },
      },
      convertedFromDetectionIndex: index,
    };
    setAnnotations((prev) => [...prev, newAnnotation]);
    // Mark detection as converted (rejected visually)
    setDetectionActions((prev) => {
      const next = new Map(prev);
      next.set(index, { status: 'rejected' });
      return next;
    });
  }, [annotations.length]);

  const handleUndoConversion = useCallback((annotation: ManualAnnotation) => {
    const detIndex = annotation.convertedFromDetectionIndex;
    // Remove the annotation
    setAnnotations((prev) => prev.filter((a) => a.id !== annotation.id));
    setSelectedAnnotationId((prev) => (prev === annotation.id ? null : prev));
    // Restore the detection
    if (detIndex !== undefined) {
      setDetectionActions((prev) => {
        const next = new Map(prev);
        next.delete(detIndex);
        return next;
      });
    }
  }, []);

  const tags = Object.keys(TAG_COLORS);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#030712', color: 'white', padding: 32 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>Marker Sandbox</h1>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>
              Click a detection marker to expand its action panel.
            </p>
          </div>
          <button
            onClick={() => setShowDevLog((v) => !v)}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: showDevLog ? '1px solid #6366f1' : '1px solid #374151',
              backgroundColor: showDevLog ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: showDevLog ? '#a5b4fc' : '#9ca3af',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            {showDevLog ? 'Hide' : 'Show'} Dev Log
          </button>
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          {/* Canvas Area */}
          <div>
            <div
              style={{
                position: 'relative',
                width: IMAGE_WIDTH,
                height: IMAGE_HEIGHT,
                border: '1px solid #374151',
                borderRadius: 8,
                overflow: 'visible',
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e293b 100%)',
              }}
            >
              {/* Grid overlay */}
              <svg
                width={IMAGE_WIDTH}
                height={IMAGE_HEIGHT}
                style={{ position: 'absolute', inset: 0, opacity: 0.08 }}
              >
                <defs>
                  <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                    <path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {/* Annotation Layer */}
              <React.Suspense fallback={<div style={{ color: '#666', padding: 20 }}>Loading layer...</div>}>
                <AnnotationLayer
                  imageDimensions={{ width: IMAGE_WIDTH, height: IMAGE_HEIGHT }}
                  imagePosition={{ left: 0, top: 0 }}
                  existingDetections={showDetections ? MOCK_DETECTIONS : []}
                  manualAnnotations={showAnnotations ? annotations : []}
                  isAnnotationMode={isAnnotationMode}
                  selectedTagForDrawing={selectedTagForDrawing}
                  tagColors={TAG_COLORS}
                  selectedAnnotationId={selectedAnnotationId}
                  zoom={1}
                  onAddAnnotation={handleAddAnnotation}
                  onUpdateAnnotation={handleUpdateAnnotation}
                  onDeleteAnnotation={handleDeleteAnnotation}
                  onSelectAnnotation={handleSelectAnnotation}
                  onNoTagSelected={() => {}}
                  markerConstants={markerConstants}
                  expandableDetections={true}
                  detectionActions={detectionActions}
                  onDetectionAction={handleDetectionAction}
                  onConvertToAnnotation={handleConvertToAnnotation}
                  onUndoConversion={handleUndoConversion}
                  availableTags={tags}
                  modelName="YOLOv8-Defects"
                  modelVersion="2.1.4"
                />
              </React.Suspense>
            </div>
          </div>

          {/* Control Panel */}
          <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: IMAGE_HEIGHT, overflowY: 'auto' }}>
            {/* Visibility */}
            <Panel title="Visibility">
              <Toggle label={`Detections (${MOCK_DETECTIONS.length})`} checked={showDetections} onChange={setShowDetections} />
              <Toggle label={`Annotations (${annotations.length})`} checked={showAnnotations} onChange={setShowAnnotations} />
            </Panel>

            {/* Detections with action state */}
            <Panel title="Detections (from model)">
              {MOCK_DETECTIONS.map((det, i) => {
                const action = detectionActions.get(i);
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12,
                    opacity: action?.status === 'rejected' ? 0.4 : 1,
                  }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                      backgroundColor: action?.status === 'accepted' ? '#22c55e' : (det.color || '#ef4444'),
                    }} />
                    <span style={{
                      flex: 1,
                      textDecoration: action?.reclassifiedTo ? 'line-through' : 'none',
                      color: action?.reclassifiedTo ? '#6b7280' : 'white',
                    }}>
                      {det.label || 'Detection'}
                    </span>
                    {action?.reclassifiedTo && (
                      <span style={{ color: '#60a5fa', fontSize: 11 }}>{action.reclassifiedTo}</span>
                    )}
                    {action?.status && (
                      <span style={{
                        fontSize: 10, padding: '1px 4px', borderRadius: 3,
                        backgroundColor: action.status === 'accepted' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                        color: action.status === 'accepted' ? '#22c55e' : '#ef4444',
                      }}>
                        {action.status === 'rejected'
                          ? action.rejectionReason === 'false_positive' ? 'false positive'
                            : action.rejectionReason === 'wrong_label' ? 'wrong label'
                            : 'rejected'
                          : action.status}
                      </span>
                    )}
                    {det.confidence !== undefined && !action?.status && (
                      <span style={{ color: '#6b7280' }}>{(det.confidence * 100).toFixed(0)}%</span>
                    )}
                  </div>
                );
              })}
              {detectionActions.size > 0 && (
                <button
                  onClick={() => setDetectionActions(new Map())}
                  style={{
                    width: '100%', marginTop: 8, padding: '4px 0', borderRadius: 4,
                    border: '1px solid #374151', backgroundColor: 'transparent',
                    color: '#9ca3af', fontSize: 11, cursor: 'pointer',
                  }}
                >
                  Reset All Actions
                </button>
              )}
            </Panel>

            {/* Annotations */}
            <Panel title="Annotations (user-drawn)">
              {annotations.length === 0 ? (
                <p style={{ fontSize: 12, color: '#6b7280' }}>None yet. Enable drawing to add.</p>
              ) : (
                annotations.map((ann) => (
                  <div
                    key={ann.id}
                    onClick={() => handleSelectAnnotation(ann.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
                      fontSize: 12, cursor: 'pointer', padding: '2px 4px', borderRadius: 4,
                      backgroundColor: selectedAnnotationId === ann.id ? '#1f2937' : 'transparent',
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: TAG_COLORS[ann.title] || '#666', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{ann.title}</span>
                    <span style={{ color: '#6b7280' }}>
                      {Math.round((ann.shape.p2.x - ann.shape.p1.x) * IMAGE_WIDTH)}x
                      {Math.round((ann.shape.p2.y - ann.shape.p1.y) * IMAGE_HEIGHT)}
                    </span>
                  </div>
                ))
              )}
            </Panel>

            {/* Annotation Mode */}
            <Panel title="Annotation Mode">
              <button
                onClick={() => {
                  setIsAnnotationMode((prev) => {
                    if (prev) {
                      setSelectedTagForDrawing(null);
                      setSelectedAnnotationId(null);
                    }
                    return !prev;
                  });
                }}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 4, border: 'none',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  backgroundColor: isAnnotationMode ? '#2563eb' : '#1f2937',
                  color: isAnnotationMode ? 'white' : '#d1d5db',
                }}
              >
                {isAnnotationMode ? 'Drawing Mode ON' : 'Enable Drawing'}
              </button>
              {isAnnotationMode && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>Select tag to draw:</p>
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTagForDrawing((prev) => (prev === tag ? null : tag))}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px',
                        borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 12, marginBottom: 2,
                        backgroundColor: selectedTagForDrawing === tag ? TAG_COLORS[tag] : 'transparent',
                        color: selectedTagForDrawing === tag ? 'white' : '#d1d5db',
                        fontWeight: selectedTagForDrawing === tag ? 500 : 400,
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </Panel>

            {/* Marker Constants */}
            <Panel title="Marker Constants">
              <Slider label="LABEL_HEIGHT" value={markerConstants.LABEL_HEIGHT} min={14} max={32}
                onChange={(v) => setMarkerConstants((prev) => ({ ...prev, LABEL_HEIGHT: v }))} />
              <Slider label="FONT_SIZE" value={markerConstants.LABEL_FONT_SIZE} min={8} max={18}
                onChange={(v) => setMarkerConstants((prev) => ({ ...prev, LABEL_FONT_SIZE: v }))} />
              <Slider label="CHAR_WIDTH" value={markerConstants.LABEL_CHAR_WIDTH} min={4} max={12}
                onChange={(v) => setMarkerConstants((prev) => ({ ...prev, LABEL_CHAR_WIDTH: v }))} />
              <Slider label="PADDING" value={markerConstants.LABEL_PADDING} min={2} max={16}
                onChange={(v) => setMarkerConstants((prev) => ({ ...prev, LABEL_PADDING: v }))} />
              <Slider label="BTN_SIZE" value={markerConstants.ACTION_BTN_SIZE} min={12} max={28}
                onChange={(v) => setMarkerConstants((prev) => ({ ...prev, ACTION_BTN_SIZE: v }))} />
              <Slider label="DET_RADIUS" value={markerConstants.DETECTION_LABEL_RADIUS} min={0} max={12}
                onChange={(v) => setMarkerConstants((prev) => ({ ...prev, DETECTION_LABEL_RADIUS: v }))} />
              <Slider label="ANN_RADIUS" value={markerConstants.ANNOTATION_LABEL_RADIUS} min={0} max={12}
                onChange={(v) => setMarkerConstants((prev) => ({ ...prev, ANNOTATION_LABEL_RADIUS: v }))} />
              <button
                onClick={() => setMarkerConstants({ ...DEFAULT_CONSTANTS })}
                style={{
                  width: '100%', marginTop: 4, padding: '4px 0', borderRadius: 4,
                  border: '1px solid #374151', backgroundColor: 'transparent',
                  color: '#9ca3af', fontSize: 11, cursor: 'pointer',
                }}
              >
                Reset Defaults
              </button>
            </Panel>
          </div>
        </div>

        {/* Development Log */}
        {showDevLog && <DevelopmentLog />}
      </div>
    </div>
  );
}

// --- Development Log ---

const DEV_LOG_ENTRIES: {
  phase: string;
  title: string;
  status: 'complete' | 'active';
  thought: string;
  decisions: string[];
  files: string[];
}[] = [
  {
    phase: 'Phase 1',
    title: 'AnnotationLayer — Expandable Detection Markers',
    status: 'complete',
    thought:
      'The existing AnnotationLayer only supported static detection overlays and user-drawn annotations. For human-in-the-loop workflows, operators need to interact with AI predictions — accept correct detections, reject false positives, reclassify wrong labels, and convert detections into editable annotations. I needed to design an extensible interaction model without breaking the existing component contract.',
    decisions: [
      'Opt-in architecture: Added `expandableDetections` boolean prop so existing consumers (ImageReviewModal) remain unaffected — zero breaking changes.',
      'State lifted to parent: `detectionActions` Map<number, DetectionActionState> lives in the parent, not inside AnnotationLayer. This follows React\'s unidirectional data flow and makes the state serializable for future cloud sync.',
      'SVG-native panel: The expanded action panel uses <foreignObject> inside the SVG rather than a DOM overlay. This keeps coordinate math simple — the panel attaches directly to the detection\'s pixel position without transform calculations.',
      'Three-tier rejection: "Nothing Here" (false positive) vs "Wrong Label" (with reclassification tag picker). This distinction matters for model retraining — false positives and label errors require different corrective training strategies.',
      'Detection-to-Annotation conversion: One-click convert copies the detection\'s bounding box into a ManualAnnotation with `convertedFromDetectionIndex` backlink. Undo restores the original detection. This preserves the full provenance chain.',
    ],
    files: [
      'src/components/AnnotationLayer.tsx (+700 lines)',
      'src/types/index.ts (MarkerConstants, DetectionActionState interfaces)',
      'src/app/globals.css (marching-dots animation for active annotations)',
    ],
  },
  {
    phase: 'Phase 2',
    title: 'Marker Sandbox — Isolated Testing Environment',
    status: 'complete',
    thought:
      'The AnnotationLayer is deeply embedded in the ImageReviewModal, which requires socket connection, batch data, and auth context. Iterating on marker rendering inside that stack is slow and fragile. I needed a standalone page where I could test every AnnotationLayer feature in isolation with mock data and live-tunable constants.',
    decisions: [
      'Next.js App Router /sandbox route: Automatic code-splitting, doesn\'t affect production bundle unless visited.',
      'React.lazy() for AnnotationLayer: Even in the sandbox, lazy-load the component to validate that the lazy boundary works correctly.',
      'Live marker constant sliders: LABEL_HEIGHT, FONT_SIZE, CHAR_WIDTH, PADDING, BTN_SIZE, corner radius — all adjustable in real-time. This eliminated dozens of build-refresh cycles during visual tuning.',
      'Mock data covers edge cases: 4 detections with varying confidence levels, 2 pre-seeded annotations, all 7 tag colors. Tests the full rendering matrix.',
      'Control panel mirrors production state: Visibility toggles, annotation mode, tag selection, detection action states — all visible in the sidebar for inspection during demos.',
    ],
    files: [
      'src/app/sandbox/page.tsx (this file — 425 lines)',
    ],
  },
  {
    phase: 'Phase 3',
    title: 'Portrait / Responsive Layout Adaptation',
    status: 'complete',
    thought:
      'Factory kiosks occasionally use portrait-oriented monitors. The original layout assumed landscape with a fixed 320px sidebar, which caused content to overflow or compress too much on narrow screens. Rather than a full responsive rewrite, I targeted the specific breakpoints that matter for our deployment.',
    decisions: [
      'useIsPortrait hook: Uses `matchMedia("(orientation: portrait)")` with event listener — reactive, no polling, SSR-safe with useEffect hydration.',
      'Conditional class application, not CSS media queries: Passed `isPortrait` as a prop to components. This gives fine-grained control (e.g., Sidebar width 224px vs 320px, grid columns 4 max vs 6 max) that\'s harder to express in pure CSS.',
      'Sidebar compresses gracefully: Reduced padding, tag button sizes, and max-width for tag labels. Content reflows rather than truncating.',
      'BatchCarousel adapts: Smaller card sizes (36x28 vs 44x32), tighter spacing. Queue popover still functional.',
      'Footer hides labels in portrait: "Model:", "Version:", "Last Update:" labels hidden; values remain. Saves ~120px of horizontal space.',
    ],
    files: [
      'src/hooks/useIsPortrait.ts (new — 18 lines)',
      'src/app/page.tsx (wires isPortrait to 4 child components)',
      'src/components/Sidebar.tsx (width + padding responsive)',
      'src/components/ImageGrid.tsx (column count logic for portrait)',
      'src/components/BatchCarousel.tsx (card sizing + spacing)',
      'src/components/Header.tsx (logo size + subtitle hidden)',
      'src/components/Footer.tsx (label visibility + spacing)',
    ],
  },
  {
    phase: 'Phase 4',
    title: 'BatchCarousel — Inline Queue Size Popover',
    status: 'complete',
    thought:
      'The queue size setting was buried in the Settings modal (Data tab). Operators change this frequently during data collection sessions — starting with a large queue to survey, then shrinking to focus. Moving this to the BatchCarousel provides immediate access without interrupting workflow.',
    decisions: [
      'Popover attached to Queue badge: Click the "Queue 3/5" pill to open a 3-button popover (5, 10, 20). Stays close to where the user is already looking.',
      'Outside-click dismissal: useEffect with document mousedown listener + ref containment check. Standard pattern, no portal needed.',
      'onMaxQueueSizeChange callback: New prop on BatchCarouselProps. Parent (page.tsx) dispatches to AppContext. Keeps the carousel a controlled component.',
      'Visual feedback: Active size gets purple highlight matching the app\'s accent color. Small upward arrow nub on the popover for visual anchoring.',
    ],
    files: [
      'src/components/BatchCarousel.tsx (+35 lines for popover)',
      'src/types/index.ts (onMaxQueueSizeChange prop)',
      'src/app/page.tsx (wires callback to dispatch)',
    ],
  },
  {
    phase: 'Phase 5',
    title: 'Drag & Resize Robustness — Window-Level Listeners',
    status: 'complete',
    thought:
      'During annotation drawing and resizing, the mouse frequently leaves the SVG element boundary (fast gestures, small annotation boxes near edges). The original implementation used SVG onMouseMove/onMouseUp, which lost tracking when the cursor exited the SVG. This caused "stuck" drag states and lost annotations.',
    decisions: [
      'Window-level mousemove/mouseup: Separate useEffect hooks activate only when drag or resize is active. Guarantees the operation completes even if the cursor goes off-screen.',
      'Ref-based callbacks: `onUpdateAnnotationRef` avoids stale closures in the window listeners. The ref always points to the latest callback without re-registering listeners.',
      'screenToNormalizedRef: Same pattern for the coordinate conversion function — window listeners need access to the latest version.',
      'Cleanup on unmount: Both effects return removeEventListener in their cleanup, preventing memory leaks if the component unmounts mid-drag.',
      'SVG onMouseLeave no longer cancels: Only the drawing preview resets on mouseleave; drag and resize operations are handled exclusively by window listeners.',
    ],
    files: [
      'src/components/AnnotationLayer.tsx (useEffect hooks at lines 409-471)',
    ],
  },
  {
    phase: 'Phase 6',
    title: 'Mock Data Generator Hardening',
    status: 'complete',
    thought:
      'The mock data generator was silently failing when imported — if the dynamic import failed (e.g., build error in the module), the UI would show the toggle as active but no batches would appear. Also, activating mock data while paused meant ADD_BATCH dispatches were silently dropped by the reducer.',
    decisions: [
      'Unpause on mock enable: `dispatch({ type: "SET_PAUSED", payload: false })` before starting the mock interval. Prevents the confusing scenario where mock data appears to not work.',
      '.catch() on dynamic import: Logs the error and resets `isMockDataActive` to false. Gives the developer a clear signal in console instead of silent failure.',
    ],
    files: [
      'src/app/page.tsx (mock data activation block, +6 lines)',
    ],
  },
  {
    phase: 'Phase 7',
    title: 'ImageReviewModal — Expandable Detection Integration',
    status: 'complete',
    thought:
      'The expandable detection markers and action panel were designed and tested in the Sandbox. The final step was integrating them into the production ImageReviewModal. The AnnotationLayer already supported all needed props via opt-in architecture — zero changes to the component itself. The work was (1) adding per-image detection action state, (2) wiring the new props, (3) building a sidebar panel to show detection review status, and (4) switching from ImageWithBoundingBoxes built-in rendering to AnnotationLayer-only rendering.',
    decisions: [
      'Local state with per-image keying: `Map<string, Map<number, DetectionActionState>>` keyed by imageKey. Persists within the modal session (navigating between images) but resets on close. No AppContext changes needed — ephemeral is correct for review workflow.',
      'Always hide ImageWithBoundingBoxes boxes: `hideBoundingBoxes={true}` unconditionally. AnnotationLayer renders superior detection markers with AI badges, action state feedback, and expandable panels.',
      'Detections sidebar panel: Shows all AI detections with their current action status (accepted/rejected/reclassified). Includes "Reset All Actions" button. Placed between Annotation Tools and Image Info sections.',
      'AnnotationLayer keyed by imageKey: `key={imageKey}` forces component remount on image change, naturally resetting internal expand state without prop drilling.',
      'Convert-to-annotation auto-adds tag: When a detection is converted, its tag is added to localTags, ensuring the upload button becomes enabled.',
    ],
    files: [
      'src/components/ImageReviewModal.tsx (state, handlers, sidebar panel, AnnotationLayer props)',
      'src/app/sandbox/page.tsx (Phase 7 dev log entry)',
    ],
  },
];

function DevelopmentLog() {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  return (
    <div style={{ marginTop: 32, borderTop: '1px solid #1f2937', paddingTop: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>Development Log</h2>
        <p style={{ color: '#6b7280', fontSize: 13 }}>
          Thought process, design decisions, and implementation notes for each feature phase.
        </p>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="Phases" value={String(DEV_LOG_ENTRIES.length)} color="#6366f1" />
        <StatCard label="Files Modified" value="11" color="#3b82f6" />
        <StatCard label="Lines Added" value="~1000" color="#22c55e" />
        <StatCard label="New Interfaces" value="2" color="#f59e0b" />
      </div>

      {/* Architecture overview */}
      <div style={{
        backgroundColor: '#0c1222', border: '1px solid #1e3a5f', borderRadius: 8,
        padding: 16, marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Architectural Approach
        </h3>
        <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.7 }}>
          <p style={{ marginBottom: 8 }}>
            <strong style={{ color: 'white' }}>Core principle:</strong> Extend, don&apos;t rewrite. Every change to AnnotationLayer
            is additive and opt-in via new props. Existing consumers (ImageReviewModal) are unaffected — zero regressions.
          </p>
          <p style={{ marginBottom: 8 }}>
            <strong style={{ color: 'white' }}>State ownership:</strong> Detection action state (accept/reject/reclassify)
            is owned by the parent component, not AnnotationLayer. This follows React&apos;s lifting-state-up pattern
            and keeps the annotation layer a pure rendering component.
          </p>
          <p>
            <strong style={{ color: 'white' }}>Testing strategy:</strong> The Sandbox page serves as both a development
            tool and a living specification. Mock data covers the full feature matrix. Live-tunable constants
            eliminate guess-and-check CSS iterations.
          </p>
        </div>
      </div>

      {/* Phase entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DEV_LOG_ENTRIES.map((entry, i) => {
          const isExpanded = expandedPhase === i;
          return (
            <div
              key={i}
              style={{
                backgroundColor: '#111827', borderRadius: 8,
                border: isExpanded ? '1px solid #4f46e5' : '1px solid #1f2937',
                overflow: 'hidden', transition: 'border-color 0.15s ease',
              }}
            >
              {/* Phase header */}
              <button
                onClick={() => setExpandedPhase(isExpanded ? null : i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#6366f1',
                  backgroundColor: 'rgba(99,102,241,0.15)', padding: '2px 8px',
                  borderRadius: 4, letterSpacing: '0.05em', flexShrink: 0,
                }}>
                  {entry.phase}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'white', flex: 1 }}>
                  {entry.title}
                </span>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10,
                  backgroundColor: entry.status === 'complete' ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
                  color: entry.status === 'complete' ? '#22c55e' : '#fbbf24',
                  fontWeight: 600, flexShrink: 0,
                }}>
                  {entry.status === 'complete' ? 'Complete' : 'In Progress'}
                </span>
                <svg
                  width="12" height="12" viewBox="0 0 12 12" fill="none"
                  stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}
                >
                  <path d="M2 4L6 8L10 4" />
                </svg>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid #1f2937' }}>
                  {/* Thought process */}
                  <div style={{ marginTop: 12, marginBottom: 16 }}>
                    <h4 style={{ fontSize: 10, fontWeight: 600, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      Thought Process
                    </h4>
                    <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.7 }}>
                      {entry.thought}
                    </p>
                  </div>

                  {/* Design decisions */}
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ fontSize: 10, fontWeight: 600, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Key Decisions
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {entry.decisions.map((d, j) => (
                        <div key={j} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
                          <span style={{ color: '#6366f1', fontWeight: 700, flexShrink: 0 }}>{j + 1}.</span>
                          <span>{d}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Files touched */}
                  <div>
                    <h4 style={{ fontSize: 10, fontWeight: 600, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      Files Touched
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {entry.files.map((f, j) => (
                        <span key={j} style={{
                          fontSize: 11, fontFamily: 'monospace', color: '#9ca3af',
                          backgroundColor: 'rgba(255,255,255,0.05)', padding: '3px 8px',
                          borderRadius: 4, border: '1px solid #1f2937',
                        }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Type system additions */}
      <div style={{
        marginTop: 24, backgroundColor: '#111827', borderRadius: 8,
        border: '1px solid #1f2937', padding: 16,
      }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Type System Additions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <code style={{ fontSize: 11, color: '#a5b4fc', fontFamily: 'monospace' }}>MarkerConstants</code>
            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4, lineHeight: 1.5 }}>
              7-field interface for overridable rendering constants (label height, font size, char width,
              padding, button size, corner radii). Allows sandbox tuning without magic numbers.
            </p>
          </div>
          <div>
            <code style={{ fontSize: 11, color: '#a5b4fc', fontFamily: 'monospace' }}>DetectionActionState</code>
            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4, lineHeight: 1.5 }}>
              Union-typed status field (pending | accepted | rejected) with optional rejectionReason
              (false_positive | wrong_label), originalLabel, and reclassifiedTo. Models the complete
              detection review workflow.
            </p>
          </div>
        </div>
      </div>

      {/* Data flow diagram */}
      <div style={{
        marginTop: 16, backgroundColor: '#111827', borderRadius: 8,
        border: '1px solid #1f2937', padding: 16,
      }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Detection Review Data Flow
        </h3>
        <pre style={{
          fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', lineHeight: 1.8,
          whiteSpace: 'pre', overflowX: 'auto',
        }}>
{`AI Model Output                    Operator Action                  Training Pipeline
─────────────                    ───────────────                  ─────────────────
BoundingBox[]  ──────────────▶  Click marker label  ──────────▶  Expand action panel
  (from socket)                        │
                                       ├─ Accept (thumbs up)  ──▶  status: 'accepted'
                                       │                           (confirms correct detection)
                                       │
                                       ├─ Reject ─┬─ Nothing Here ──▶  status: 'rejected'
                                       │          │                     reason: 'false_positive'
                                       │          │
                                       │          └─ Wrong Label  ──▶  status: 'rejected'
                                       │               └─ Pick tag     reason: 'wrong_label'
                                       │                               reclassifiedTo: 'dent'
                                       │
                                       └─ Convert to Annotation  ──▶  ManualAnnotation created
                                                                       (editable, draggable, resizable)
                                                                       Original detection hidden
                                                                       Undo restores detection`}
        </pre>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      backgroundColor: '#111827', borderRadius: 8, padding: 12,
      border: '1px solid #1f2937', textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

// --- Sub-components ---

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#111827', borderRadius: 8, padding: 12, border: '1px solid #1f2937' }}>
      <h3 style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, cursor: 'pointer', fontSize: 12 }}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Slider({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
        <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>{label}</span>
        <span style={{ color: 'white', fontWeight: 600, fontFamily: 'monospace' }}>{value}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#3b82f6', height: 4 }}
      />
    </div>
  );
}
