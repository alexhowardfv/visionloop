'use client';

import React, { useMemo, useState } from 'react';
import { Tooltip } from './Tooltip';

interface Detection {
  tag?: string;
  label?: string;
  confidence?: number;
  score?: number;
  box?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface WebSocketMessage {
  model?: string;
  version?: string;
  pass_fail?: string;
  overall_pass_fail?: string;
  total_inputs?: number;
  total_time?: number | string;
  workstation?: string;
  type?: string;
  detections?: Detection[] | number;
  tags?: Detection[];
  _timestamp?: number;
  [key: string]: any;
}

interface DataAnalyticsProps {
  isOpen: boolean;
  onClose: () => void;
  capturedData: WebSocketMessage[];
  onImportData?: (data: WebSocketMessage[]) => void;
  tagColors?: Record<string, string>;
}

interface TagCount {
  tag: string;
  count: number;
  percentage: number;
  targetDelta?: number; // How many more samples needed to reach median
}

interface DetectionWithMeta {
  tag: string;
  confidence: number;
  box?: number[];
  messageIndex: number;
  passFail: string;
}

interface TagConfidenceStats {
  tag: string;
  avgConfidence: number;
  minConfidence: number;
  count: number;
}

interface TimeSeriesPoint {
  timestamp: number;
  hour: string;
  pass: number;
  fail: number;
  total: number;
  passRate: number;
}

interface AnalyticsData {
  tagDistribution: TagCount[];
  passFailDistribution: { pass: number; fail: number; unknown: number };
  modelDistribution: { model: string; count: number; passRate: number }[];
  workstationDistribution: { workstation: string; count: number; passRate: number }[];
  typeDistribution: { type: string; count: number }[];
  confidenceStats: { min: number; max: number; avg: number; median: number; p90: number; p95: number };
  confidenceHistogram: { bucket: string; count: number; range: [number, number] }[];
  tagPassFailRates: { tag: string; pass: number; fail: number; total: number; passRate: number; avgConfidence: number }[];
  tagConfidenceStats: TagConfidenceStats[];
  allDetections: DetectionWithMeta[];
  lowConfidenceDetections: DetectionWithMeta[];
  totalDetections: number;
  totalMessages: number;
  timeRange: { start: number; end: number } | null;
  medianClassCount: number;
  // QC Metrics
  firstPassYield: number;
  defectRate: number;
  avgProcessingTime: number;
  timeSeries: TimeSeriesPoint[];
  defectPareto: { tag: string; count: number; cumulative: number; cumulativePercent: number }[];
  // Advanced Results Analytics
  advancedResults: AdvancedResultsData;
}

interface AdvancedResultsData {
  inspectionPassFail: { pass: number; fail: number; total: number; passRate: number };
  histogramPassFail: { pass: number; fail: number; total: number; passRate: number };
  overallResult: { pass: number; fail: number; total: number; passRate: number };
  hasAdvancedData: boolean;
  correlation: {
    bothPass: number;
    bothFail: number;
    inspectionPassHistogramFail: number;
    inspectionFailHistogramPass: number;
  };
  agreementRate: number;
  timeSeries: { timestamp: number; hour: string; inspectionPass: number; inspectionFail: number; histogramPass: number; histogramFail: number; overallPass: number; overallFail: number }[];
}

const COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
  '#6366F1', // indigo
];

const CONFIDENCE_BUCKETS = [
  { label: '0-50%', range: [0, 0.5] as [number, number] },
  { label: '50-60%', range: [0.5, 0.6] as [number, number] },
  { label: '60-70%', range: [0.6, 0.7] as [number, number] },
  { label: '70-80%', range: [0.7, 0.8] as [number, number] },
  { label: '80-90%', range: [0.8, 0.9] as [number, number] },
  { label: '90-95%', range: [0.9, 0.95] as [number, number] },
  { label: '95-99%', range: [0.95, 0.99] as [number, number] },
  { label: '99-100%', range: [0.99, 1.01] as [number, number] },
];

export const DataAnalytics: React.FC<DataAnalyticsProps> = ({
  isOpen,
  onClose,
  capturedData,
  onImportData,
  tagColors = {},
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'tags' | 'confidence' | 'quality' | 'heatmap' | 'edge' | 'trends' | 'pareto' | 'results'>('overview');
  const [importedData, setImportedData] = useState<WebSocketMessage[]>([]);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);
  const [thresholdSimulator, setThresholdSimulator] = useState(0.5);
  const [qualitySortBy, setQualitySortBy] = useState<'passRate' | 'total' | 'fails'>('passRate');
  const [heatmapMode, setHeatmapMode] = useState<'all' | 'pass' | 'fail'>('all');
  const [edgeFilterTag, setEdgeFilterTag] = useState<string>('all');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const dataToAnalyze = importedData.length > 0 ? importedData : capturedData;

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const data = Array.isArray(json) ? json : [json];
        setImportedData(data);
        if (onImportData) {
          onImportData(data);
        }
      } catch (err) {
        console.error('Failed to parse JSON file:', err);
        alert('Failed to parse JSON file. Please ensure it is valid JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearImported = () => {
    setImportedData([]);
  };

  const analytics = useMemo((): AnalyticsData => {
    const tagCounts: Record<string, number> = {};
    const tagConfidences: Record<string, number[]> = {};
    const modelCounts: Record<string, { total: number; pass: number }> = {};
    const workstationCounts: Record<string, { total: number; pass: number }> = {};
    const typeCounts: Record<string, number> = {};
    const tagPassFail: Record<string, { pass: number; fail: number; confidences: number[] }> = {};
    const hourlyData: Record<string, { pass: number; fail: number; total: number; timestamp: number }> = {};
    const advancedHourlyData: Record<string, { inspectionPass: number; inspectionFail: number; histogramPass: number; histogramFail: number; overallPass: number; overallFail: number; timestamp: number }> = {};
    let passCount = 0;
    let failCount = 0;
    let unknownCount = 0;

    // Advanced Results tracking
    let inspectionPassCount = 0;
    let inspectionFailCount = 0;
    let histogramPassCount = 0;
    let histogramFailCount = 0;
    let overallPassCount = 0;
    let overallFailCount = 0;
    let bothPassCount = 0;
    let bothFailCount = 0;
    let inspectionPassHistogramFailCount = 0;
    let inspectionFailHistogramPassCount = 0;
    let totalDetections = 0;
    let totalProcessingTime = 0;
    let processingTimeCount = 0;
    const confidences: number[] = [];
    const allDetections: DetectionWithMeta[] = [];
    let minTime: number | null = null;
    let maxTime: number | null = null;

    const processDetection = (det: Detection, messageIndex: number, passFail: string) => {
      totalDetections++;
      const tag = det.tag || det.label || 'Unknown';
      const confidence = det.score ?? det.confidence ?? 0;

      tagCounts[tag] = (tagCounts[tag] || 0) + 1;

      // Track confidences per tag
      if (!tagConfidences[tag]) tagConfidences[tag] = [];
      if (confidence > 0) tagConfidences[tag].push(confidence);

      // Track pass/fail by tag with confidences
      if (!tagPassFail[tag]) {
        tagPassFail[tag] = { pass: 0, fail: 0, confidences: [] };
      }
      if (passFail === 'PASS') {
        tagPassFail[tag].pass++;
      } else if (passFail === 'FAIL') {
        tagPassFail[tag].fail++;
      }
      if (confidence > 0) {
        tagPassFail[tag].confidences.push(confidence);
      }

      if (confidence > 0) {
        confidences.push(confidence);
      }

      allDetections.push({
        tag,
        confidence,
        box: det.box,
        messageIndex,
        passFail,
      });
    };

    dataToAnalyze.forEach((msg, msgIndex) => {
      const status = msg.pass_fail || msg.overall_pass_fail || 'UNKNOWN';
      const isPassing = status === 'PASS';
      if (isPassing) passCount++;
      else if (status === 'FAIL') failCount++;
      else unknownCount++;

      // Track processing time
      if (msg.total_time) {
        const time = typeof msg.total_time === 'string' ? parseFloat(msg.total_time) : msg.total_time;
        if (!isNaN(time)) {
          totalProcessingTime += time;
          processingTimeCount++;
        }
      }

      if (msg.model) {
        if (!modelCounts[msg.model]) modelCounts[msg.model] = { total: 0, pass: 0 };
        modelCounts[msg.model].total++;
        if (isPassing) modelCounts[msg.model].pass++;
      }

      if (msg.workstation) {
        if (!workstationCounts[msg.workstation]) workstationCounts[msg.workstation] = { total: 0, pass: 0 };
        workstationCounts[msg.workstation].total++;
        if (isPassing) workstationCounts[msg.workstation].pass++;
      }

      if (msg.type) {
        typeCounts[msg.type] = (typeCounts[msg.type] || 0) + 1;
      }

      if (msg._timestamp) {
        if (minTime === null || msg._timestamp < minTime) minTime = msg._timestamp;
        if (maxTime === null || msg._timestamp > maxTime) maxTime = msg._timestamp;

        // Aggregate by hour for time series
        const date = new Date(msg._timestamp);
        const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
        if (!hourlyData[hourKey]) {
          hourlyData[hourKey] = { pass: 0, fail: 0, total: 0, timestamp: msg._timestamp };
        }
        hourlyData[hourKey].total++;
        if (isPassing) hourlyData[hourKey].pass++;
        else if (status === 'FAIL') hourlyData[hourKey].fail++;

        // Advanced results time series
        if (!advancedHourlyData[hourKey]) {
          advancedHourlyData[hourKey] = { inspectionPass: 0, inspectionFail: 0, histogramPass: 0, histogramFail: 0, overallPass: 0, overallFail: 0, timestamp: msg._timestamp };
        }
      }

      // Track advanced results (inspection_pass_fail, histogram_pass_fail, overall_result)
      const inspectionResult = msg.inspection_pass_fail != null ? String(msg.inspection_pass_fail).toLowerCase().trim() : '';
      const histogramResult = msg.histogram_pass_fail != null ? String(msg.histogram_pass_fail).toLowerCase().trim() : '';
      const overallResultValue = msg.overall_result != null ? String(msg.overall_result).toLowerCase().trim() : '';

      // Helper to check if value indicates pass or fail/reject/donate
      const isPass = (val: string) => val === 'pass' || val === 'true' || val === '1';
      const isFail = (val: string) => val === 'fail' || val === 'reject' || val === 'donate' || val === 'false' || val === '0';

      if (inspectionResult && isPass(inspectionResult)) {
        inspectionPassCount++;
        if (msg._timestamp) {
          const date = new Date(msg._timestamp);
          const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
          if (advancedHourlyData[hourKey]) advancedHourlyData[hourKey].inspectionPass++;
        }
      } else if (inspectionResult && isFail(inspectionResult)) {
        inspectionFailCount++;
        if (msg._timestamp) {
          const date = new Date(msg._timestamp);
          const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
          if (advancedHourlyData[hourKey]) advancedHourlyData[hourKey].inspectionFail++;
        }
      }

      if (histogramResult && isPass(histogramResult)) {
        histogramPassCount++;
        if (msg._timestamp) {
          const date = new Date(msg._timestamp);
          const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
          if (advancedHourlyData[hourKey]) advancedHourlyData[hourKey].histogramPass++;
        }
      } else if (histogramResult && isFail(histogramResult)) {
        histogramFailCount++;
        if (msg._timestamp) {
          const date = new Date(msg._timestamp);
          const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
          if (advancedHourlyData[hourKey]) advancedHourlyData[hourKey].histogramFail++;
        }
      }

      if (overallResultValue && isPass(overallResultValue)) {
        overallPassCount++;
        if (msg._timestamp) {
          const date = new Date(msg._timestamp);
          const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
          if (advancedHourlyData[hourKey]) advancedHourlyData[hourKey].overallPass++;
        }
      } else if (overallResultValue && isFail(overallResultValue)) {
        overallFailCount++;
        if (msg._timestamp) {
          const date = new Date(msg._timestamp);
          const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
          if (advancedHourlyData[hourKey]) advancedHourlyData[hourKey].overallFail++;
        }
      }

      // Track correlation between inspection and histogram results (only when both have valid values)
      const inspectionIsValid = inspectionResult && (isPass(inspectionResult) || isFail(inspectionResult));
      const histogramIsValid = histogramResult && (isPass(histogramResult) || isFail(histogramResult));

      if (inspectionIsValid && histogramIsValid) {
        if (isPass(inspectionResult) && isPass(histogramResult)) bothPassCount++;
        else if (isFail(inspectionResult) && isFail(histogramResult)) bothFailCount++;
        else if (isPass(inspectionResult) && isFail(histogramResult)) inspectionPassHistogramFailCount++;
        else if (isFail(inspectionResult) && isPass(histogramResult)) inspectionFailHistogramPassCount++;
      }

      if (msg.tags && Array.isArray(msg.tags)) {
        msg.tags.forEach((tagItem: any) => {
          processDetection(tagItem, msgIndex, status);
        });
      }

      if (msg.detections && Array.isArray(msg.detections)) {
        msg.detections.forEach((det) => {
          processDetection(det, msgIndex, status);
        });
      }

      if (msg.results && typeof msg.results === 'object') {
        Object.values(msg.results).forEach((cameraResult: any) => {
          if (cameraResult && cameraResult.detections && Array.isArray(cameraResult.detections)) {
            cameraResult.detections.forEach((det: Detection) => {
              processDetection(det, msgIndex, status);
            });
          }
          if (cameraResult && cameraResult.tags && Array.isArray(cameraResult.tags)) {
            cameraResult.tags.forEach((tagItem: any) => {
              processDetection(tagItem, msgIndex, status);
            });
          }
        });
      }
    });

    // Calculate median class count for target recommendations
    const counts = Object.values(tagCounts).sort((a, b) => a - b);
    const medianClassCount = counts.length > 0
      ? counts[Math.floor(counts.length / 2)]
      : 0;

    // Convert tag counts to sorted array with target delta
    const tagDistribution: TagCount[] = Object.entries(tagCounts)
      .map(([tag, count]) => ({
        tag,
        count,
        percentage: totalDetections > 0 ? (count / totalDetections) * 100 : 0,
        targetDelta: Math.max(0, medianClassCount - count),
      }))
      .sort((a, b) => b.count - a.count);

    const modelDistribution = Object.entries(modelCounts)
      .map(([model, data]) => ({
        model,
        count: data.total,
        passRate: data.total > 0 ? (data.pass / data.total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    const workstationDistribution = Object.entries(workstationCounts)
      .map(([workstation, data]) => ({
        workstation,
        count: data.total,
        passRate: data.total > 0 ? (data.pass / data.total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    // Time series data
    const timeSeries: TimeSeriesPoint[] = Object.entries(hourlyData)
      .map(([hour, data]) => ({
        timestamp: data.timestamp,
        hour,
        pass: data.pass,
        fail: data.fail,
        total: data.total,
        passRate: data.total > 0 ? (data.pass / data.total) * 100 : 0,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    // Defect Pareto (failures by tag)
    const failuresByTag = Object.entries(tagPassFail)
      .map(([tag, stats]) => ({ tag, count: stats.fail }))
      .filter(t => t.count > 0)
      .sort((a, b) => b.count - a.count);

    const totalFailures = failuresByTag.reduce((sum, t) => sum + t.count, 0);
    let cumulative = 0;
    const defectPareto = failuresByTag.map(item => {
      cumulative += item.count;
      return {
        tag: item.tag,
        count: item.count,
        cumulative,
        cumulativePercent: totalFailures > 0 ? (cumulative / totalFailures) * 100 : 0,
      };
    });

    const typeDistribution = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    // Calculate confidence stats with percentiles
    const sortedConfidences = [...confidences].sort((a, b) => a - b);
    const confidenceStats = {
      min: confidences.length > 0 ? Math.min(...confidences) : 0,
      max: confidences.length > 0 ? Math.max(...confidences) : 0,
      avg: confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0,
      median: sortedConfidences.length > 0 ? sortedConfidences[Math.floor(sortedConfidences.length / 2)] : 0,
      p90: sortedConfidences.length > 0 ? sortedConfidences[Math.floor(sortedConfidences.length * 0.9)] : 0,
      p95: sortedConfidences.length > 0 ? sortedConfidences[Math.floor(sortedConfidences.length * 0.95)] : 0,
    };

    const confidenceHistogram = CONFIDENCE_BUCKETS.map(bucket => ({
      bucket: bucket.label,
      count: confidences.filter(c => c >= bucket.range[0] && c < bucket.range[1]).length,
      range: bucket.range,
    }));

    // Tag pass/fail rates with avg confidence
    const tagPassFailRates = Object.entries(tagPassFail)
      .map(([tag, stats]) => ({
        tag,
        pass: stats.pass,
        fail: stats.fail,
        total: stats.pass + stats.fail,
        passRate: stats.pass + stats.fail > 0 ? (stats.pass / (stats.pass + stats.fail)) * 100 : 0,
        avgConfidence: stats.confidences.length > 0
          ? stats.confidences.reduce((a, b) => a + b, 0) / stats.confidences.length
          : 0,
      }))
      .sort((a, b) => a.passRate - b.passRate);

    // Per-tag confidence stats
    const tagConfidenceStats: TagConfidenceStats[] = Object.entries(tagConfidences)
      .map(([tag, confs]) => ({
        tag,
        avgConfidence: confs.length > 0 ? confs.reduce((a, b) => a + b, 0) / confs.length : 0,
        minConfidence: confs.length > 0 ? Math.min(...confs) : 0,
        count: confs.length,
      }))
      .sort((a, b) => a.avgConfidence - b.avgConfidence);

    const lowConfidenceDetections = allDetections
      .filter(d => d.confidence > 0 && d.confidence < 0.8)
      .sort((a, b) => a.confidence - b.confidence);

    // Calculate QC metrics
    const totalInspected = passCount + failCount;
    const firstPassYield = totalInspected > 0 ? (passCount / totalInspected) * 100 : 0;
    const defectRate = totalInspected > 0 ? (failCount / totalInspected) * 100 : 0;
    const avgProcessingTime = processingTimeCount > 0 ? totalProcessingTime / processingTimeCount : 0;

    // Calculate Advanced Results Analytics
    const inspectionTotal = inspectionPassCount + inspectionFailCount;
    const histogramTotal = histogramPassCount + histogramFailCount;
    const overallTotal = overallPassCount + overallFailCount;
    const correlationTotal = bothPassCount + bothFailCount + inspectionPassHistogramFailCount + inspectionFailHistogramPassCount;

    const advancedResultsTimeSeries = Object.entries(advancedHourlyData)
      .map(([hour, data]) => ({
        timestamp: data.timestamp,
        hour,
        inspectionPass: data.inspectionPass,
        inspectionFail: data.inspectionFail,
        histogramPass: data.histogramPass,
        histogramFail: data.histogramFail,
        overallPass: data.overallPass,
        overallFail: data.overallFail,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    const advancedResults: AdvancedResultsData = {
      inspectionPassFail: {
        pass: inspectionPassCount,
        fail: inspectionFailCount,
        total: inspectionTotal,
        passRate: inspectionTotal > 0 ? (inspectionPassCount / inspectionTotal) * 100 : 0,
      },
      histogramPassFail: {
        pass: histogramPassCount,
        fail: histogramFailCount,
        total: histogramTotal,
        passRate: histogramTotal > 0 ? (histogramPassCount / histogramTotal) * 100 : 0,
      },
      overallResult: {
        pass: overallPassCount,
        fail: overallFailCount,
        total: overallTotal,
        passRate: overallTotal > 0 ? (overallPassCount / overallTotal) * 100 : 0,
      },
      hasAdvancedData: inspectionTotal > 0 || histogramTotal > 0 || overallTotal > 0,
      correlation: {
        bothPass: bothPassCount,
        bothFail: bothFailCount,
        inspectionPassHistogramFail: inspectionPassHistogramFailCount,
        inspectionFailHistogramPass: inspectionFailHistogramPassCount,
      },
      agreementRate: correlationTotal > 0 ? ((bothPassCount + bothFailCount) / correlationTotal) * 100 : 0,
      timeSeries: advancedResultsTimeSeries,
    };

    return {
      tagDistribution,
      passFailDistribution: { pass: passCount, fail: failCount, unknown: unknownCount },
      modelDistribution,
      workstationDistribution,
      typeDistribution,
      confidenceStats,
      confidenceHistogram,
      tagPassFailRates,
      tagConfidenceStats,
      allDetections,
      lowConfidenceDetections,
      totalDetections,
      totalMessages: dataToAnalyze.length,
      timeRange: minTime && maxTime ? { start: minTime, end: maxTime } : null,
      medianClassCount,
      // QC Metrics
      firstPassYield,
      defectRate,
      avgProcessingTime,
      timeSeries,
      defectPareto,
      advancedResults,
    };
  }, [dataToAnalyze]);

  const maxTagCount = useMemo(() => {
    return Math.max(...analytics.tagDistribution.map((t) => t.count), 1);
  }, [analytics.tagDistribution]);

  const maxHistogramCount = useMemo(() => {
    return Math.max(...analytics.confidenceHistogram.map((h) => h.count), 1);
  }, [analytics.confidenceHistogram]);

  // Threshold simulator - count detections that would be filtered
  const thresholdSimulatorResults = useMemo(() => {
    const filtered = analytics.allDetections.filter(d => d.confidence > 0 && d.confidence < thresholdSimulator);
    const kept = analytics.allDetections.filter(d => d.confidence >= thresholdSimulator || d.confidence === 0);
    return {
      filteredCount: filtered.length,
      keptCount: kept.length,
      filteredPercent: analytics.allDetections.length > 0
        ? (filtered.length / analytics.allDetections.length) * 100
        : 0,
    };
  }, [analytics.allDetections, thresholdSimulator]);

  // Sorted quality data based on selected sort
  const sortedQualityData = useMemo(() => {
    return [...analytics.tagPassFailRates].sort((a, b) => {
      switch (qualitySortBy) {
        case 'passRate': return a.passRate - b.passRate;
        case 'total': return b.total - a.total;
        case 'fails': return b.fail - a.fail;
        default: return 0;
      }
    });
  }, [analytics.tagPassFailRates, qualitySortBy]);

  // Calculate heatmap data with pass/fail filtering
  const heatmapData = useMemo(() => {
    const gridSize = 10;
    const grid: number[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
    let totalWithBoxes = 0;

    const filteredDetections = analytics.allDetections.filter(det => {
      if (heatmapMode === 'all') return true;
      if (heatmapMode === 'pass') return det.passFail === 'PASS';
      if (heatmapMode === 'fail') return det.passFail === 'FAIL';
      return true;
    });

    filteredDetections.forEach(det => {
      if (det.box && det.box.length >= 4) {
        totalWithBoxes++;
        const centerX = (det.box[0] + det.box[2]) / 2;
        const centerY = (det.box[1] + det.box[3]) / 2;
        const gridX = Math.min(Math.floor(centerX * gridSize), gridSize - 1);
        const gridY = Math.min(Math.floor(centerY * gridSize), gridSize - 1);
        if (gridX >= 0 && gridY >= 0) {
          grid[gridY][gridX]++;
        }
      }
    });

    const maxVal = Math.max(...grid.flat(), 1);
    const cellsWithData = grid.flat().filter(v => v > 0).length;
    const coveragePercent = (cellsWithData / 100) * 100;

    return { grid, maxVal, totalWithBoxes, coveragePercent };
  }, [analytics.allDetections, heatmapMode]);

  // Filter edge cases based on threshold and tag filter
  const edgeCases = useMemo(() => {
    return analytics.allDetections
      .filter(d => d.confidence > 0 && d.confidence < confidenceThreshold)
      .filter(d => edgeFilterTag === 'all' || d.tag === edgeFilterTag)
      .sort((a, b) => a.confidence - b.confidence);
  }, [analytics.allDetections, confidenceThreshold, edgeFilterTag]);

  // Edge case distribution by tag
  const edgeCasesByTag = useMemo(() => {
    const byTag: Record<string, number> = {};
    analytics.allDetections
      .filter(d => d.confidence > 0 && d.confidence < confidenceThreshold)
      .forEach(d => {
        byTag[d.tag] = (byTag[d.tag] || 0) + 1;
      });
    return Object.entries(byTag)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [analytics.allDetections, confidenceThreshold]);

  // Export edge cases to JSON
  const handleExportEdgeCases = () => {
    const exportData = edgeCases.map(d => ({
      tag: d.tag,
      confidence: d.confidence,
      passFail: d.passFail,
      messageIndex: d.messageIndex,
    }));
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edge-cases-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export QC Report
  const handleExportReport = () => {
    const report = {
      reportTitle: 'Quality Control Analytics Report',
      generatedAt: new Date().toISOString(),
      summary: {
        totalInspections: analytics.totalMessages,
        totalDetections: analytics.totalDetections,
        firstPassYield: `${analytics.firstPassYield.toFixed(2)}%`,
        defectRate: `${analytics.defectRate.toFixed(2)}%`,
        passCount: analytics.passFailDistribution.pass,
        failCount: analytics.passFailDistribution.fail,
        unknownCount: analytics.passFailDistribution.unknown,
        avgCycleTime: analytics.avgProcessingTime > 0 ? `${analytics.avgProcessingTime.toFixed(0)}ms` : 'N/A',
      },
      timeRange: analytics.timeRange ? {
        start: new Date(analytics.timeRange.start).toISOString(),
        end: new Date(analytics.timeRange.end).toISOString(),
      } : null,
      defectPareto: analytics.defectPareto.map((d, i) => ({
        rank: i + 1,
        defectType: d.tag,
        count: d.count,
        percentOfTotal: ((d.count / analytics.passFailDistribution.fail) * 100).toFixed(1) + '%',
        cumulativePercent: d.cumulativePercent.toFixed(1) + '%',
      })),
      qualityByTag: analytics.tagPassFailRates.map(t => ({
        tag: t.tag,
        passCount: t.pass,
        failCount: t.fail,
        total: t.total,
        passRate: t.passRate.toFixed(1) + '%',
        avgConfidence: (t.avgConfidence * 100).toFixed(1) + '%',
      })),
      modelPerformance: analytics.modelDistribution.map(m => ({
        model: m.model,
        inspections: m.count,
        passRate: m.passRate.toFixed(1) + '%',
      })),
      workstationPerformance: analytics.workstationDistribution.map(w => ({
        workstation: w.workstation,
        inspections: w.count,
        passRate: w.passRate.toFixed(1) + '%',
      })),
      confidenceStats: {
        min: (analytics.confidenceStats.min * 100).toFixed(1) + '%',
        max: (analytics.confidenceStats.max * 100).toFixed(1) + '%',
        avg: (analytics.confidenceStats.avg * 100).toFixed(1) + '%',
        median: (analytics.confidenceStats.median * 100).toFixed(1) + '%',
        p90: (analytics.confidenceStats.p90 * 100).toFixed(1) + '%',
        p95: (analytics.confidenceStats.p95 * 100).toFixed(1) + '%',
      },
      classDistribution: analytics.tagDistribution.map(t => ({
        class: t.tag,
        count: t.count,
        percentage: t.percentage.toFixed(1) + '%',
      })),
    };

    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qc-report-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Unique tags for filter dropdown
  const uniqueTags = useMemo(() => {
    return [...new Set(analytics.allDetections.map(d => d.tag))].sort();
  }, [analytics.allDetections]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-7xl h-[90vh] bg-primary rounded-xl shadow-elevated overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-primary-lighter">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <div>
              <h2 className="text-white text-xl font-semibold">Training Data Analytics</h2>
              <p className="text-text-muted text-sm">
                {analytics.totalMessages} messages | {analytics.totalDetections} detections | {analytics.tagDistribution.length} classes
                {importedData.length > 0 && ' (imported)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
            <Tooltip content="Import JSON file" position="bottom">
              <button onClick={handleImportClick} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition-all flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                </svg>
                Import
              </button>
            </Tooltip>
            {analytics.totalMessages > 0 && (
              <Tooltip content="Export QC Report" position="bottom">
                <button onClick={handleExportReport} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-white text-sm transition-all flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  Export Report
                </button>
              </Tooltip>
            )}
            {importedData.length > 0 && (
              <button onClick={handleClearImported} className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded transition-all">
                Clear Imported
              </button>
            )}
            <button onClick={onClose} className="text-text-secondary hover:text-white transition-colors ml-2">
              <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-primary-lighter overflow-x-auto">
          {[
            { id: 'overview', label: 'QC Overview' },
            { id: 'trends', label: 'Trends' },
            { id: 'pareto', label: 'Defect Pareto' },
            { id: 'quality', label: 'Quality by Tag' },
            { id: 'tags', label: 'Class Balance' },
            { id: 'confidence', label: 'Confidence' },
            { id: 'heatmap', label: 'Heatmap' },
            { id: 'edge', label: 'Edge Cases' },
            { id: 'results', label: 'Advanced Results', badge: analytics.advancedResults.hasAdvancedData },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id ? 'text-white border-b-2 border-purple-500' : 'text-text-secondary hover:text-white'
              }`}
            >
              {tab.label}
              {'badge' in tab && tab.badge && (
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* QC Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Top KPI Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-primary-lighter rounded-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-green-400 text-sm font-medium">First Pass Yield</span>
                    <svg className="w-6 h-6 text-green-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                  <p className={`text-4xl font-bold ${analytics.firstPassYield >= 95 ? 'text-green-400' : analytics.firstPassYield >= 85 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {analytics.firstPassYield.toFixed(1)}%
                  </p>
                  <p className="text-text-muted text-xs mt-1">
                    {analytics.firstPassYield >= 95 ? 'Excellent' : analytics.firstPassYield >= 85 ? 'Acceptable' : 'Needs Improvement'}
                  </p>
                </div>

                <div className="bg-primary-lighter rounded-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-red-400 text-sm font-medium">Defect Rate</span>
                    <svg className="w-6 h-6 text-red-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                  <p className={`text-4xl font-bold ${analytics.defectRate <= 5 ? 'text-green-400' : analytics.defectRate <= 15 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {analytics.defectRate.toFixed(1)}%
                  </p>
                  <p className="text-text-muted text-xs mt-1">
                    {analytics.passFailDistribution.fail} of {analytics.passFailDistribution.pass + analytics.passFailDistribution.fail} inspections
                  </p>
                </div>

                <div className="bg-primary-lighter rounded-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-400 text-sm font-medium">Total Inspected</span>
                    <svg className="w-6 h-6 text-blue-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                  </div>
                  <p className="text-4xl font-bold text-white">
                    {analytics.totalMessages.toLocaleString()}
                  </p>
                  <p className="text-text-muted text-xs mt-1">
                    {analytics.totalDetections.toLocaleString()} total detections
                  </p>
                </div>

                <div className="bg-primary-lighter rounded-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-purple-400 text-sm font-medium">Avg Cycle Time</span>
                    <svg className="w-6 h-6 text-purple-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                  <p className="text-4xl font-bold text-white">
                    {analytics.avgProcessingTime > 0 ? `${analytics.avgProcessingTime.toFixed(0)}` : 'N/A'}
                  </p>
                  <p className="text-text-muted text-xs mt-1">
                    {analytics.avgProcessingTime > 0 ? 'milliseconds' : 'No timing data'}
                  </p>
                </div>
              </div>

              {/* Main Content Row */}
              <div className="grid grid-cols-2 gap-6">
                {/* Pass/Fail Pie Chart */}
                <div className="bg-primary-lighter rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-4">Pass/Fail Distribution</h3>
                  {analytics.passFailDistribution.pass + analytics.passFailDistribution.fail === 0 ? (
                    <div className="flex items-center justify-center h-48 text-text-muted">
                      No inspection data available
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-8">
                      {/* SVG Pie Chart */}
                      <div className="relative">
                        <svg width="180" height="180" viewBox="0 0 180 180">
                          {(() => {
                            const total = analytics.passFailDistribution.pass + analytics.passFailDistribution.fail;
                            const passPercent = total > 0 ? analytics.passFailDistribution.pass / total : 0;
                            const passAngle = passPercent * 360;
                            const radius = 80;
                            const cx = 90;
                            const cy = 90;

                            // Calculate pass arc
                            const passEndX = cx + radius * Math.sin((passAngle * Math.PI) / 180);
                            const passEndY = cy - radius * Math.cos((passAngle * Math.PI) / 180);
                            const largeArcPass = passAngle > 180 ? 1 : 0;

                            // Full circle for 100%
                            if (passPercent >= 1) {
                              return <circle cx={cx} cy={cy} r={radius} fill="#10B981" />;
                            }
                            if (passPercent <= 0) {
                              return <circle cx={cx} cy={cy} r={radius} fill="#EF4444" />;
                            }

                            return (
                              <>
                                {/* Fail portion (background) */}
                                <circle cx={cx} cy={cy} r={radius} fill="#EF4444" />
                                {/* Pass portion */}
                                <path
                                  d={`M ${cx} ${cy} L ${cx} ${cy - radius} A ${radius} ${radius} 0 ${largeArcPass} 1 ${passEndX} ${passEndY} Z`}
                                  fill="#10B981"
                                />
                              </>
                            );
                          })()}
                          {/* Center circle for donut effect */}
                          <circle cx="90" cy="90" r="50" fill="#1a1f2e" />
                          {/* Center text */}
                          <text x="90" y="85" textAnchor="middle" className="fill-white text-2xl font-bold">
                            {analytics.firstPassYield.toFixed(0)}%
                          </text>
                          <text x="90" y="105" textAnchor="middle" className="fill-gray-400 text-xs">
                            FPY
                          </text>
                        </svg>
                      </div>

                      {/* Legend */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded bg-green-500"></div>
                          <div>
                            <p className="text-white font-medium">Pass</p>
                            <p className="text-text-muted text-sm">{analytics.passFailDistribution.pass.toLocaleString()} ({((analytics.passFailDistribution.pass / (analytics.passFailDistribution.pass + analytics.passFailDistribution.fail)) * 100).toFixed(1)}%)</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded bg-red-500"></div>
                          <div>
                            <p className="text-white font-medium">Fail</p>
                            <p className="text-text-muted text-sm">{analytics.passFailDistribution.fail.toLocaleString()} ({((analytics.passFailDistribution.fail / (analytics.passFailDistribution.pass + analytics.passFailDistribution.fail)) * 100).toFixed(1)}%)</p>
                          </div>
                        </div>
                        {analytics.passFailDistribution.unknown > 0 && (
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded bg-gray-500"></div>
                            <div>
                              <p className="text-white font-medium">Unknown</p>
                              <p className="text-text-muted text-sm">{analytics.passFailDistribution.unknown.toLocaleString()}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Model/Workstation Performance */}
                <div className="bg-primary-lighter rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-4">Performance by Source</h3>
                  <div className="space-y-4 max-h-[280px] overflow-y-auto">
                    {analytics.modelDistribution.length > 0 && (
                      <div>
                        <p className="text-text-muted text-xs mb-2 uppercase">By Model</p>
                        {analytics.modelDistribution.slice(0, 3).map((item) => (
                          <div key={item.model} className="flex items-center justify-between py-2 border-b border-border/50">
                            <span className="text-white text-sm">{item.model}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-text-muted text-xs">{item.count} runs</span>
                              <span className={`font-medium ${item.passRate >= 95 ? 'text-green-400' : item.passRate >= 85 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {item.passRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {analytics.workstationDistribution.length > 0 && (
                      <div>
                        <p className="text-text-muted text-xs mb-2 uppercase">By Workstation</p>
                        {analytics.workstationDistribution.slice(0, 4).map((item) => (
                          <div key={item.workstation} className="flex items-center justify-between py-2 border-b border-border/50">
                            <span className="text-white text-sm">{item.workstation}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-text-muted text-xs">{item.count} runs</span>
                              <span className={`font-medium ${item.passRate >= 95 ? 'text-green-400' : item.passRate >= 85 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {item.passRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {analytics.modelDistribution.length === 0 && analytics.workstationDistribution.length === 0 && (
                      <div className="text-center text-text-muted py-8">
                        No model or workstation data available
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Defects Quick View */}
              <div className="bg-primary-lighter rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">Top Defect Types</h3>
                  <button
                    onClick={() => setActiveTab('pareto')}
                    className="text-purple-400 text-sm hover:text-purple-300 transition-colors"
                  >
                    View Pareto →
                  </button>
                </div>
                {analytics.defectPareto.length === 0 ? (
                  <div className="text-center text-text-muted py-4">
                    No defects recorded - great job!
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-4">
                    {analytics.defectPareto.slice(0, 5).map((defect, i) => (
                      <div key={defect.tag} className="bg-primary rounded-lg p-4 text-center">
                        <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center text-sm font-bold ${
                          i === 0 ? 'bg-yellow-500 text-yellow-900' :
                          i === 1 ? 'bg-gray-300 text-gray-700' :
                          i === 2 ? 'bg-amber-600 text-amber-100' :
                          'bg-primary-lighter text-text-secondary'
                        }`}>
                          {i + 1}
                        </div>
                        <p className="text-white font-medium text-sm truncate" title={defect.tag}>{defect.tag}</p>
                        <p className="text-red-400 text-lg font-bold">{defect.count}</p>
                        <p className="text-text-muted text-xs">
                          {((defect.count / analytics.passFailDistribution.fail) * 100).toFixed(0)}% of fails
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quality Status Banner */}
              <div className="bg-primary-lighter rounded-lg p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {analytics.firstPassYield >= 95 ? (
                      <svg className="w-10 h-10 text-green-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
                      </svg>
                    ) : analytics.firstPassYield >= 85 ? (
                      <svg className="w-10 h-10 text-yellow-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                      </svg>
                    ) : (
                      <svg className="w-10 h-10 text-red-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                      </svg>
                    )}
                    <div>
                      <p className={`font-bold text-lg ${
                        analytics.firstPassYield >= 95 ? 'text-green-400' : analytics.firstPassYield >= 85 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {analytics.firstPassYield >= 95
                          ? 'Quality Target Met!'
                          : analytics.firstPassYield >= 85
                          ? 'Quality Within Tolerance'
                          : 'Quality Below Target'}
                      </p>
                      <p className="text-text-secondary text-sm">
                        {analytics.firstPassYield >= 95
                          ? 'First pass yield is excellent. Keep up the great work!'
                          : analytics.firstPassYield >= 85
                          ? 'Performance is acceptable but there\'s room for improvement.'
                          : `Review the Pareto analysis to identify the top ${Math.min(3, analytics.defectPareto.length)} defects contributing to failures.`}
                      </p>
                    </div>
                  </div>
                  {analytics.timeRange && (
                    <div className="text-right">
                      <p className="text-text-muted text-xs">Data Range</p>
                      <p className="text-white text-sm">
                        {new Date(analytics.timeRange.start).toLocaleDateString()} - {new Date(analytics.timeRange.end).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Trends Tab */}
          {activeTab === 'trends' && (
            <div className="space-y-6">
              <h3 className="text-white text-lg font-semibold">Quality Trends Over Time</h3>

              {analytics.timeSeries.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-text-muted mx-auto mb-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                  </svg>
                  <p className="text-text-secondary">No time series data available</p>
                  <p className="text-text-muted text-sm mt-1">Data must include timestamps to show trends</p>
                </div>
              ) : (
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-primary-lighter rounded-lg p-4">
                      <p className="text-text-muted text-xs mb-1">Time Periods</p>
                      <p className="text-white text-2xl font-bold">{analytics.timeSeries.length}</p>
                    </div>
                    <div className="bg-primary-lighter rounded-lg p-4">
                      <p className="text-text-muted text-xs mb-1">Best Period</p>
                      <p className="text-green-400 text-2xl font-bold">
                        {Math.max(...analytics.timeSeries.map(t => t.passRate)).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-primary-lighter rounded-lg p-4">
                      <p className="text-text-muted text-xs mb-1">Worst Period</p>
                      <p className="text-red-400 text-2xl font-bold">
                        {Math.min(...analytics.timeSeries.map(t => t.passRate)).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-primary-lighter rounded-lg p-4">
                      <p className="text-text-muted text-xs mb-1">Trend</p>
                      {(() => {
                        const first = analytics.timeSeries[0]?.passRate || 0;
                        const last = analytics.timeSeries[analytics.timeSeries.length - 1]?.passRate || 0;
                        const diff = last - first;
                        return (
                          <p className={`text-2xl font-bold ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {diff >= 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(1)}%
                          </p>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Time Series Chart */}
                  <div className="bg-primary-lighter rounded-xl p-6">
                    <h4 className="text-white font-medium mb-4">Pass Rate by Hour</h4>
                    <div className="relative h-64">
                      {/* Y-axis labels */}
                      <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-text-muted text-xs">
                        <span>100%</span>
                        <span>75%</span>
                        <span>50%</span>
                        <span>25%</span>
                        <span>0%</span>
                      </div>

                      {/* Chart area */}
                      <div className="ml-14 h-full flex items-end gap-1 overflow-x-auto pb-8">
                        {analytics.timeSeries.map((point, i) => (
                          <div key={i} className="flex-shrink-0 flex flex-col items-center" style={{ width: Math.max(40, 100 / analytics.timeSeries.length) + '%' }}>
                            <div
                              className="w-full max-w-[40px] rounded-t transition-all duration-300 relative group"
                              style={{
                                height: `${(point.passRate / 100) * 200}px`,
                                backgroundColor: point.passRate >= 95 ? '#10B981' : point.passRate >= 85 ? '#F59E0B' : '#EF4444',
                              }}
                            >
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black/90 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                                <p className="font-medium">{point.hour}</p>
                                <p>Pass: {point.pass} | Fail: {point.fail}</p>
                                <p>Rate: {point.passRate.toFixed(1)}%</p>
                              </div>
                            </div>
                            <span className="text-text-muted text-xs mt-2 transform -rotate-45 origin-left whitespace-nowrap">
                              {point.hour.split(' ')[1] || point.hour}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* 95% threshold line */}
                      <div className="absolute left-14 right-0 border-t-2 border-dashed border-green-500/50" style={{ top: `${100 - 95}%` }}>
                        <span className="absolute right-0 -top-3 text-green-400 text-xs bg-primary-lighter px-1">95% Target</span>
                      </div>
                    </div>
                  </div>

                  {/* Hourly Breakdown Table */}
                  <div className="bg-primary-lighter rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-primary">
                        <tr>
                          <th className="text-left text-text-muted text-xs font-medium px-4 py-3">Period</th>
                          <th className="text-right text-text-muted text-xs font-medium px-4 py-3">Pass</th>
                          <th className="text-right text-text-muted text-xs font-medium px-4 py-3">Fail</th>
                          <th className="text-right text-text-muted text-xs font-medium px-4 py-3">Total</th>
                          <th className="text-right text-text-muted text-xs font-medium px-4 py-3">Pass Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {analytics.timeSeries.slice(-10).reverse().map((point, i) => (
                          <tr key={i} className="hover:bg-primary/50">
                            <td className="px-4 py-3 text-white">{point.hour}</td>
                            <td className="px-4 py-3 text-right text-green-400">{point.pass}</td>
                            <td className="px-4 py-3 text-right text-red-400">{point.fail}</td>
                            <td className="px-4 py-3 text-right text-text-secondary">{point.total}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-medium ${point.passRate >= 95 ? 'text-green-400' : point.passRate >= 85 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {point.passRate.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Defect Pareto Tab */}
          {activeTab === 'pareto' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white text-lg font-semibold">Defect Pareto Analysis</h3>
                  <p className="text-text-muted text-sm">Identify the vital few defects causing most failures (80/20 rule)</p>
                </div>
              </div>

              {analytics.defectPareto.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-green-400 mx-auto mb-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <p className="text-green-400 text-lg font-medium">No Defects Found!</p>
                  <p className="text-text-muted text-sm mt-1">All inspections passed - excellent quality</p>
                </div>
              ) : (
                <>
                  {/* 80/20 Insight */}
                  {(() => {
                    const eightyPercent = analytics.defectPareto.find(d => d.cumulativePercent >= 80);
                    const countTo80 = eightyPercent ? analytics.defectPareto.indexOf(eightyPercent) + 1 : analytics.defectPareto.length;
                    return (
                      <div className="bg-primary-lighter rounded-lg p-5">
                        <div className="flex items-center gap-4">
                          <svg className="w-10 h-10 text-yellow-400 flex-shrink-0" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                          </svg>
                          <div>
                            <p className="text-yellow-400 font-bold text-lg">80/20 Insight</p>
                            <p className="text-text-secondary">
                              <span className="text-white font-medium">{countTo80} defect type{countTo80 !== 1 ? 's' : ''}</span> account for 80% of all failures.
                              Focus improvement efforts on these to maximize impact.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Pareto Chart */}
                  <div className="bg-primary-lighter rounded-xl p-6">
                    <div className="relative h-80">
                      {/* Chart */}
                      <div className="flex items-end gap-2 h-64 pr-12">
                        {analytics.defectPareto.slice(0, 10).map((item, i) => {
                          const maxCount = analytics.defectPareto[0]?.count || 1;
                          const barHeight = (item.count / maxCount) * 100;
                          return (
                            <div key={item.tag} className="flex-1 flex flex-col items-center relative group">
                              {/* Bar */}
                              <div
                                className="w-full rounded-t transition-all duration-300"
                                style={{
                                  height: `${barHeight}%`,
                                  backgroundColor: item.cumulativePercent <= 80 ? '#EF4444' : '#F59E0B',
                                  minHeight: '20px',
                                }}
                              >
                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-white text-xs font-medium">
                                  {item.count}
                                </span>
                              </div>
                              {/* Label */}
                              <span className="text-text-muted text-xs mt-2 transform -rotate-45 origin-left truncate max-w-[60px]" title={item.tag}>
                                {item.tag}
                              </span>
                              {/* Cumulative line point */}
                              <div
                                className="absolute w-3 h-3 bg-blue-500 rounded-full border-2 border-white"
                                style={{
                                  bottom: `${(item.cumulativePercent / 100) * 256}px`,
                                  right: '-6px',
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* 80% line */}
                      <div className="absolute left-0 right-0 border-t-2 border-dashed border-yellow-500" style={{ bottom: `${(80 / 100) * 256 + 16}px` }}>
                        <span className="absolute right-0 -top-3 text-yellow-400 text-xs">80%</span>
                      </div>

                      {/* Cumulative % axis */}
                      <div className="absolute right-0 top-0 h-64 w-12 flex flex-col justify-between items-end text-text-muted text-xs">
                        <span>100%</span>
                        <span>75%</span>
                        <span>50%</span>
                        <span>25%</span>
                        <span>0%</span>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Table */}
                  <div className="bg-primary-lighter rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-primary">
                        <tr>
                          <th className="text-left text-text-muted text-xs font-medium px-4 py-3">Rank</th>
                          <th className="text-left text-text-muted text-xs font-medium px-4 py-3">Defect Type</th>
                          <th className="text-right text-text-muted text-xs font-medium px-4 py-3">Count</th>
                          <th className="text-right text-text-muted text-xs font-medium px-4 py-3">% of Total</th>
                          <th className="text-right text-text-muted text-xs font-medium px-4 py-3">Cumulative %</th>
                          <th className="text-text-muted text-xs font-medium px-4 py-3 w-40">Cumulative</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {analytics.defectPareto.map((item, i) => (
                          <tr key={item.tag} className={`hover:bg-primary/50 ${item.cumulativePercent <= 80 ? 'bg-red-500/5' : ''}`}>
                            <td className="px-4 py-3 text-white font-medium">#{i + 1}</td>
                            <td className="px-4 py-3 text-white">{item.tag}</td>
                            <td className="px-4 py-3 text-right text-red-400 font-medium">{item.count}</td>
                            <td className="px-4 py-3 text-right text-text-secondary">
                              {((item.count / analytics.passFailDistribution.fail) * 100).toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={item.cumulativePercent <= 80 ? 'text-yellow-400 font-medium' : 'text-text-secondary'}>
                                {item.cumulativePercent.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="h-2 bg-primary rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${item.cumulativePercent <= 80 ? 'bg-yellow-500' : 'bg-gray-500'}`}
                                  style={{ width: `${item.cumulativePercent}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Class Balance Tab (existing) */}
          {activeTab === 'tags' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-white text-lg font-semibold">Class Imbalance Analysis</h3>
                <div className="text-text-muted text-sm">
                  Target: {analytics.medianClassCount} samples (median)
                </div>
              </div>

              {analytics.tagDistribution.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-text-muted mx-auto mb-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                  </svg>
                  <p className="text-text-secondary">No tag data available</p>
                  <p className="text-text-muted text-sm mt-1">Import data or capture websocket messages</p>
                </div>
              ) : (
                <>
                  {/* Imbalance Warning */}
                  {analytics.tagDistribution.length > 1 && (
                    <div className="bg-primary-lighter rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {analytics.tagDistribution[0].count / analytics.tagDistribution[analytics.tagDistribution.length - 1].count > 10 ? (
                            <svg className="w-6 h-6 text-red-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                            </svg>
                          ) : analytics.tagDistribution[0].count / analytics.tagDistribution[analytics.tagDistribution.length - 1].count > 3 ? (
                            <svg className="w-6 h-6 text-yellow-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                              <path d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                          ) : (
                            <svg className="w-6 h-6 text-green-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                          )}
                          <div>
                            <p className="text-white font-medium">
                              {analytics.tagDistribution[0].count / analytics.tagDistribution[analytics.tagDistribution.length - 1].count > 10
                                ? 'Severe Class Imbalance'
                                : analytics.tagDistribution[0].count / analytics.tagDistribution[analytics.tagDistribution.length - 1].count > 3
                                ? 'Moderate Imbalance'
                                : 'Good Balance'}
                            </p>
                            <p className="text-text-secondary text-sm">
                              Ratio: {(analytics.tagDistribution[0].count / analytics.tagDistribution[analytics.tagDistribution.length - 1].count).toFixed(1)}:1
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-text-muted text-xs">Total samples needed</p>
                          <p className="text-white font-bold">
                            +{analytics.tagDistribution.reduce((sum, t) => sum + (t.targetDelta || 0), 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Distribution with target markers */}
                  <div className="space-y-3">
                    {analytics.tagDistribution.map((item, index) => (
                      <div key={item.tag} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white font-medium">{item.tag}</span>
                          <div className="flex items-center gap-3">
                            {item.targetDelta && item.targetDelta > 0 && (
                              <span className="text-yellow-400 text-xs">+{item.targetDelta} needed</span>
                            )}
                            <span className="text-text-secondary">
                              {item.count} ({item.percentage.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                        <div className="h-8 bg-primary-lighter rounded-lg overflow-hidden relative">
                          {/* Target line */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-10"
                            style={{ left: `${(analytics.medianClassCount / maxTagCount) * 100}%` }}
                            title={`Target: ${analytics.medianClassCount}`}
                          />
                          <div
                            className="h-full rounded-lg transition-all duration-500 flex items-center px-3"
                            style={{
                              width: `${(item.count / maxTagCount) * 100}%`,
                              backgroundColor: item.count < analytics.medianClassCount * 0.5
                                ? '#EF4444'
                                : item.count < analytics.medianClassCount
                                ? '#F59E0B'
                                : tagColors[item.tag] || COLORS[index % COLORS.length],
                              minWidth: '40px',
                            }}
                          >
                            <span className="text-white text-xs font-medium">{item.count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Recommendations */}
                  <div className="mt-6 p-4 bg-primary-lighter rounded-lg">
                    <h4 className="text-blue-400 font-medium mb-2">Collection Priorities</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {analytics.tagDistribution
                        .filter(t => t.targetDelta && t.targetDelta > 0)
                        .slice(0, 4)
                        .map(t => (
                          <div key={t.tag} className="flex justify-between">
                            <span className="text-text-secondary">{t.tag}</span>
                            <span className="text-white">+{t.targetDelta} samples</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab 2: Enhanced Confidence Analysis */}
          {activeTab === 'confidence' && (
            <div className="space-y-6">
              <h3 className="text-white text-lg font-semibold">Confidence Score Analysis</h3>

              {analytics.confidenceHistogram.every(h => h.count === 0) ? (
                <div className="text-center py-12">
                  <p className="text-text-secondary">No confidence data available</p>
                </div>
              ) : (
                <>
                  {/* Stats Cards with Percentiles */}
                  <div className="grid grid-cols-6 gap-3">
                    <div className="bg-primary-lighter rounded-lg p-3 text-center">
                      <p className="text-text-muted text-xs mb-1">Min</p>
                      <p className="text-white text-xl font-bold">{(analytics.confidenceStats.min * 100).toFixed(0)}%</p>
                    </div>
                    <div className="bg-primary-lighter rounded-lg p-3 text-center">
                      <p className="text-text-muted text-xs mb-1">Avg</p>
                      <p className="text-white text-xl font-bold">{(analytics.confidenceStats.avg * 100).toFixed(0)}%</p>
                    </div>
                    <div className="bg-primary-lighter rounded-lg p-3 text-center">
                      <p className="text-text-muted text-xs mb-1">Median</p>
                      <p className="text-white text-xl font-bold">{(analytics.confidenceStats.median * 100).toFixed(0)}%</p>
                    </div>
                    <div className="bg-primary-lighter rounded-lg p-3 text-center">
                      <p className="text-text-muted text-xs mb-1">P90</p>
                      <p className="text-green-400 text-xl font-bold">{(analytics.confidenceStats.p90 * 100).toFixed(0)}%</p>
                    </div>
                    <div className="bg-primary-lighter rounded-lg p-3 text-center">
                      <p className="text-text-muted text-xs mb-1">P95</p>
                      <p className="text-green-400 text-xl font-bold">{(analytics.confidenceStats.p95 * 100).toFixed(0)}%</p>
                    </div>
                    <div className="bg-primary-lighter rounded-lg p-3 text-center">
                      <p className="text-text-muted text-xs mb-1">Max</p>
                      <p className="text-white text-xl font-bold">{(analytics.confidenceStats.max * 100).toFixed(0)}%</p>
                    </div>
                  </div>

                  {/* Histogram */}
                  <div className="bg-primary-lighter rounded-lg p-6">
                    <h4 className="text-white font-medium mb-4">Distribution Histogram</h4>
                    <div className="flex items-end gap-2 h-40">
                      {analytics.confidenceHistogram.map((bucket) => (
                        <div key={bucket.bucket} className="flex-1 flex flex-col items-center">
                          <div className="w-full flex flex-col items-center justify-end h-32">
                            <span className="text-white text-xs mb-1">{bucket.count}</span>
                            <div
                              className="w-full rounded-t transition-all duration-500"
                              style={{
                                height: `${(bucket.count / maxHistogramCount) * 100}%`,
                                backgroundColor: bucket.range[0] < 0.7 ? '#EF4444' : bucket.range[0] < 0.9 ? '#F59E0B' : '#10B981',
                                minHeight: bucket.count > 0 ? '4px' : '0',
                              }}
                            />
                          </div>
                          <span className="text-text-muted text-xs mt-2 transform -rotate-45 origin-center whitespace-nowrap">
                            {bucket.bucket}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Threshold Simulator */}
                  <div className="bg-primary-lighter rounded-lg p-4">
                    <h4 className="text-white font-medium mb-3">Threshold Simulator</h4>
                    <p className="text-text-muted text-sm mb-3">Preview how many detections would be filtered at different confidence thresholds</p>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="0.3"
                        max="0.95"
                        step="0.05"
                        value={thresholdSimulator}
                        onChange={(e) => setThresholdSimulator(parseFloat(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-white font-bold w-16">{(thresholdSimulator * 100).toFixed(0)}%</span>
                    </div>
                    <div className="mt-3 flex items-center gap-6">
                      <div>
                        <span className="text-red-400 font-bold">{thresholdSimulatorResults.filteredCount}</span>
                        <span className="text-text-muted text-sm ml-2">would be filtered ({thresholdSimulatorResults.filteredPercent.toFixed(1)}%)</span>
                      </div>
                      <div>
                        <span className="text-green-400 font-bold">{thresholdSimulatorResults.keptCount}</span>
                        <span className="text-text-muted text-sm ml-2">would be kept</span>
                      </div>
                    </div>
                  </div>

                  {/* Per-Tag Confidence */}
                  <div className="bg-primary-lighter rounded-lg p-4">
                    <h4 className="text-white font-medium mb-3">Confidence by Tag (Lowest First)</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {analytics.tagConfidenceStats.slice(0, 10).map((item) => (
                        <div key={item.tag} className="flex items-center justify-between">
                          <span className="text-text-secondary">{item.tag}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-text-muted text-xs">min: {(item.minConfidence * 100).toFixed(0)}%</span>
                            <span className={`font-medium ${item.avgConfidence < 0.7 ? 'text-red-400' : item.avgConfidence < 0.9 ? 'text-yellow-400' : 'text-green-400'}`}>
                              avg: {(item.avgConfidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab 3: Enhanced Quality by Tag */}
          {activeTab === 'quality' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white text-lg font-semibold">Pass/Fail Rate by Tag</h3>
                  <p className="text-text-muted text-sm">Identify problematic classes for retraining</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-muted text-sm">Sort by:</span>
                  <select
                    value={qualitySortBy}
                    onChange={(e) => setQualitySortBy(e.target.value as any)}
                    className="bg-primary-lighter border border-border rounded px-2 py-1 text-white text-sm"
                  >
                    <option value="passRate">Pass Rate (worst first)</option>
                    <option value="total">Total Count</option>
                    <option value="fails">Fail Count</option>
                  </select>
                </div>
              </div>

              {sortedQualityData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-text-secondary">No pass/fail data available</p>
                </div>
              ) : (
                <>
                  {/* Problematic Tags Alert */}
                  {sortedQualityData.some(t => t.passRate < 70 && t.avgConfidence < 0.8) && (
                    <div className="bg-primary-lighter rounded-lg p-4">
                      <p className="text-red-400 font-medium">High-Risk Tags Detected</p>
                      <p className="text-text-secondary text-sm mt-1">
                        These tags have both low pass rates AND low confidence - prioritize for retraining:
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {sortedQualityData
                          .filter(t => t.passRate < 70 && t.avgConfidence < 0.8)
                          .map(t => (
                            <span key={t.tag} className="px-2 py-1 bg-red-500/30 text-red-300 rounded text-sm">
                              {t.tag}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {sortedQualityData.map((item) => (
                      <div key={item.tag} className={`bg-primary-lighter rounded-lg p-4 ${
                        item.passRate < 70 && item.avgConfidence < 0.8 ? 'ring-2 ring-red-500/50' : ''
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{item.tag}</span>
                            {item.passRate < 70 && item.avgConfidence < 0.8 && (
                              <span className="flex items-center gap-1 text-red-400 text-xs">
                                <svg className="w-3 h-3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                </svg>
                                High Risk
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-text-muted text-xs">
                              Avg conf: {(item.avgConfidence * 100).toFixed(0)}%
                            </span>
                            <span className={`font-bold ${
                              item.passRate > 90 ? 'text-green-400' :
                              item.passRate > 70 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {item.passRate.toFixed(1)}% pass
                            </span>
                          </div>
                        </div>
                        <div className="h-6 bg-primary rounded-lg overflow-hidden flex">
                          <div
                            className="h-full bg-green-500 transition-all duration-500 flex items-center justify-center"
                            style={{ width: `${item.passRate}%` }}
                          >
                            {item.passRate > 15 && <span className="text-white text-xs">{item.pass}</span>}
                          </div>
                          <div
                            className="h-full bg-red-500 transition-all duration-500 flex items-center justify-center"
                            style={{ width: `${100 - item.passRate}%` }}
                          >
                            {100 - item.passRate > 15 && <span className="text-white text-xs">{item.fail}</span>}
                          </div>
                        </div>
                        <div className="flex justify-between mt-1 text-xs text-text-muted">
                          <span>Pass: {item.pass}</span>
                          <span>Fail: {item.fail}</span>
                          <span>Total: {item.total}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab 4: Enhanced Heatmap */}
          {activeTab === 'heatmap' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white text-lg font-semibold">Detection Location Heatmap</h3>
                  <p className="text-text-muted text-sm">Spatial distribution of detections in frame</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-muted text-sm">Show:</span>
                  <div className="flex bg-primary-lighter rounded-lg p-1">
                    {(['all', 'pass', 'fail'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setHeatmapMode(mode)}
                        className={`px-3 py-1 rounded text-sm transition-all ${
                          heatmapMode === mode
                            ? mode === 'fail' ? 'bg-red-500 text-white' : mode === 'pass' ? 'bg-green-500 text-white' : 'bg-purple-500 text-white'
                            : 'text-text-secondary hover:text-white'
                        }`}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {heatmapData.totalWithBoxes === 0 ? (
                <div className="text-center py-12">
                  <p className="text-text-secondary">No bounding box data available</p>
                  <p className="text-text-muted text-sm mt-1">Detection data must include box coordinates</p>
                </div>
              ) : (
                <>
                  {/* Coverage Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-primary-lighter rounded-lg p-4 text-center">
                      <p className="text-text-muted text-xs mb-1">Detections with Boxes</p>
                      <p className="text-white text-2xl font-bold">{heatmapData.totalWithBoxes}</p>
                    </div>
                    <div className="bg-primary-lighter rounded-lg p-4 text-center">
                      <p className="text-text-muted text-xs mb-1">Frame Coverage</p>
                      <p className={`text-2xl font-bold ${heatmapData.coveragePercent > 70 ? 'text-green-400' : heatmapData.coveragePercent > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {heatmapData.coveragePercent.toFixed(0)}%
                      </p>
                    </div>
                    <div className="bg-primary-lighter rounded-lg p-4 text-center">
                      <p className="text-text-muted text-xs mb-1">Hottest Cell</p>
                      <p className="text-white text-2xl font-bold">{heatmapData.maxVal}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="bg-primary-lighter rounded-lg p-4">
                      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(10, 1fr)` }}>
                        {heatmapData.grid.map((row, y) =>
                          row.map((value, x) => (
                            <div
                              key={`${x}-${y}`}
                              className="w-12 h-12 rounded flex items-center justify-center text-xs font-medium transition-all"
                              style={{
                                backgroundColor: value > 0
                                  ? heatmapMode === 'fail'
                                    ? `rgba(239, 68, 68, ${Math.min(value / heatmapData.maxVal, 1) * 0.9 + 0.1})`
                                    : heatmapMode === 'pass'
                                    ? `rgba(16, 185, 129, ${Math.min(value / heatmapData.maxVal, 1) * 0.9 + 0.1})`
                                    : `rgba(139, 92, 246, ${Math.min(value / heatmapData.maxVal, 1) * 0.9 + 0.1})`
                                  : 'rgba(255, 255, 255, 0.05)',
                                color: value / heatmapData.maxVal > 0.5 ? 'white' : 'rgba(255,255,255,0.5)',
                              }}
                              title={`Position (${x}, ${y}): ${value} detections`}
                            >
                              {value > 0 ? value : ''}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-primary-lighter rounded-lg max-w-xl">
                      <h4 className="text-blue-400 font-medium mb-2">Coverage Analysis</h4>
                      <div className="flex items-start gap-2">
                        {heatmapData.coveragePercent > 70 ? (
                          <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                        ) : heatmapData.coveragePercent > 40 ? (
                          <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                          </svg>
                        )}
                        <p className="text-text-secondary text-sm">
                          {heatmapData.coveragePercent > 70
                            ? 'Good spatial coverage across the frame.'
                            : heatmapData.coveragePercent > 40
                            ? 'Moderate coverage - consider collecting data from empty regions.'
                            : 'Poor coverage - significant blind spots detected. Collect more diverse data.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab 5: Enhanced Edge Cases */}
          {activeTab === 'edge' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-white text-lg font-semibold">Low Confidence Edge Cases</h3>
                  <p className="text-text-muted text-sm">Samples for review and potential retraining</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-text-secondary text-sm">Tag:</label>
                    <select
                      value={edgeFilterTag}
                      onChange={(e) => setEdgeFilterTag(e.target.value)}
                      className="bg-primary-lighter border border-border rounded px-2 py-1 text-white text-sm"
                    >
                      <option value="all">All Tags</option>
                      {uniqueTags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-text-secondary text-sm">Threshold:</label>
                    <input
                      type="range"
                      min="0.5"
                      max="0.95"
                      step="0.05"
                      value={confidenceThreshold}
                      onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-white font-medium w-12">{(confidenceThreshold * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {edgeCases.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-green-400 text-5xl mb-4">✓</div>
                  <p className="text-text-secondary">No edge cases found below {(confidenceThreshold * 100).toFixed(0)}% confidence</p>
                  <p className="text-text-muted text-sm mt-1">Your model is performing well on this data</p>
                </div>
              ) : (
                <>
                  {/* Edge Case Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-primary-lighter rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-yellow-400 font-medium">{edgeCases.length} Edge Cases Found</p>
                          <p className="text-text-secondary text-sm mt-1">
                            Below {(confidenceThreshold * 100).toFixed(0)}% confidence
                          </p>
                        </div>
                        <button
                          onClick={handleExportEdgeCases}
                          className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm transition-all flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                          </svg>
                          Export
                        </button>
                      </div>
                    </div>

                    {/* Distribution by tag mini chart */}
                    <div className="bg-primary-lighter rounded-lg p-4">
                      <p className="text-text-muted text-xs mb-2">Edge Cases by Tag</p>
                      <div className="flex flex-wrap gap-1">
                        {edgeCasesByTag.slice(0, 5).map((item, i) => (
                          <span key={item.tag} className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: `${COLORS[i % COLORS.length]}40`, color: COLORS[i % COLORS.length] }}>
                            {item.tag}: {item.count}
                          </span>
                        ))}
                        {edgeCasesByTag.length > 5 && (
                          <span className="text-text-muted text-xs">+{edgeCasesByTag.length - 5} more</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Edge Cases Table */}
                  <div className="bg-primary-lighter rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-primary">
                        <tr>
                          <th className="text-left text-text-muted text-xs font-medium px-4 py-3">Tag</th>
                          <th className="text-left text-text-muted text-xs font-medium px-4 py-3">Confidence</th>
                          <th className="text-left text-text-muted text-xs font-medium px-4 py-3">Status</th>
                          <th className="text-left text-text-muted text-xs font-medium px-4 py-3">Message #</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {edgeCases.slice(0, 50).map((det, index) => (
                          <tr key={index} className="hover:bg-primary/50">
                            <td className="px-4 py-3 text-white">{det.tag}</td>
                            <td className="px-4 py-3">
                              <span className={`font-medium ${
                                det.confidence < 0.5 ? 'text-red-400' :
                                det.confidence < 0.7 ? 'text-yellow-400' : 'text-orange-400'
                              }`}>
                                {(det.confidence * 100).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                det.passFail === 'PASS' ? 'bg-green-500/20 text-green-400' :
                                det.passFail === 'FAIL' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'
                              }`}>
                                {det.passFail}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-text-secondary">#{det.messageIndex + 1}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {edgeCases.length > 50 && (
                      <div className="px-4 py-3 bg-primary text-text-muted text-sm text-center">
                        Showing 50 of {edgeCases.length} edge cases
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Advanced Results Tab */}
          {activeTab === 'results' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white text-lg font-semibold">Advanced Results Analytics</h3>
                <p className="text-text-muted text-sm">Analysis of inspection_pass_fail, histogram_pass_fail, and overall_result</p>
              </div>

              {!analytics.advancedResults.hasAdvancedData ? (
                <div className="text-center py-16">
                  <svg className="w-16 h-16 text-text-muted mx-auto mb-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  <p className="text-text-secondary text-lg">No Advanced Results Data Available</p>
                  <p className="text-text-muted text-sm mt-2">This tab shows analytics when your data includes:</p>
                  <div className="flex justify-center gap-4 mt-4">
                    <code className="px-3 py-1 bg-primary-lighter rounded text-cyan-400 text-sm">inspection_pass_fail</code>
                    <code className="px-3 py-1 bg-primary-lighter rounded text-purple-400 text-sm">histogram_pass_fail</code>
                    <code className="px-3 py-1 bg-primary-lighter rounded text-amber-400 text-sm">overall_result</code>
                  </div>
                </div>
              ) : (
                <>
                  {/* Summary KPI Cards */}
                  <div className="grid grid-cols-4 gap-4">
                    {/* Inspection Pass/Fail */}
                    <div className="bg-primary-lighter rounded-lg p-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-cyan-400 text-sm font-medium">Inspection Pass Rate</span>
                        <svg className="w-5 h-5 text-cyan-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                        </svg>
                      </div>
                      <p className={`text-3xl font-bold ${analytics.advancedResults.inspectionPassFail.passRate >= 90 ? 'text-green-400' : analytics.advancedResults.inspectionPassFail.passRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {analytics.advancedResults.inspectionPassFail.total > 0 ? `${analytics.advancedResults.inspectionPassFail.passRate.toFixed(1)}%` : 'N/A'}
                      </p>
                      <p className="text-text-muted text-xs mt-1">
                        {analytics.advancedResults.inspectionPassFail.pass} pass / {analytics.advancedResults.inspectionPassFail.fail} fail
                      </p>
                    </div>

                    {/* Histogram Pass/Fail */}
                    <div className="bg-primary-lighter rounded-lg p-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-purple-400 text-sm font-medium">Histogram Pass Rate</span>
                        <svg className="w-5 h-5 text-purple-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                        </svg>
                      </div>
                      <p className={`text-3xl font-bold ${analytics.advancedResults.histogramPassFail.passRate >= 90 ? 'text-green-400' : analytics.advancedResults.histogramPassFail.passRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {analytics.advancedResults.histogramPassFail.total > 0 ? `${analytics.advancedResults.histogramPassFail.passRate.toFixed(1)}%` : 'N/A'}
                      </p>
                      <p className="text-text-muted text-xs mt-1">
                        {analytics.advancedResults.histogramPassFail.pass} pass / {analytics.advancedResults.histogramPassFail.fail} fail
                      </p>
                    </div>

                    {/* Overall Result */}
                    <div className="bg-primary-lighter rounded-lg p-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-amber-400 text-sm font-medium">Overall Pass Rate</span>
                        <svg className="w-5 h-5 text-amber-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
                        </svg>
                      </div>
                      <p className={`text-3xl font-bold ${analytics.advancedResults.overallResult.passRate >= 90 ? 'text-green-400' : analytics.advancedResults.overallResult.passRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {analytics.advancedResults.overallResult.total > 0 ? `${analytics.advancedResults.overallResult.passRate.toFixed(1)}%` : 'N/A'}
                      </p>
                      <p className="text-text-muted text-xs mt-1">
                        {analytics.advancedResults.overallResult.pass} pass / {analytics.advancedResults.overallResult.fail} fail
                      </p>
                    </div>

                    {/* Agreement Rate */}
                    <div className="bg-primary-lighter rounded-lg p-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-blue-400 text-sm font-medium">Inspection/Histogram Agreement</span>
                        <svg className="w-5 h-5 text-blue-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                        </svg>
                      </div>
                      <p className={`text-3xl font-bold ${analytics.advancedResults.agreementRate >= 90 ? 'text-green-400' : analytics.advancedResults.agreementRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {analytics.advancedResults.correlation.bothPass + analytics.advancedResults.correlation.bothFail + analytics.advancedResults.correlation.inspectionPassHistogramFail + analytics.advancedResults.correlation.inspectionFailHistogramPass > 0
                          ? `${analytics.advancedResults.agreementRate.toFixed(1)}%`
                          : 'N/A'}
                      </p>
                      <p className="text-text-muted text-xs mt-1">
                        Inspection & Histogram agree
                      </p>
                    </div>
                  </div>

                  {/* Comparison Charts Row */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Side by Side Comparison */}
                    <div className="bg-primary-lighter rounded-xl p-6">
                      <h4 className="text-white font-semibold mb-4">Pass/Fail Comparison</h4>
                      <div className="space-y-4">
                        {/* Inspection Bar */}
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-cyan-400">Inspection</span>
                            <span className="text-text-muted">{analytics.advancedResults.inspectionPassFail.total} total</span>
                          </div>
                          <div className="h-8 bg-primary rounded-lg overflow-hidden flex">
                            <div
                              className="bg-green-500 h-full transition-all duration-500 flex items-center justify-center text-xs font-medium text-white"
                              style={{ width: `${analytics.advancedResults.inspectionPassFail.total > 0 ? (analytics.advancedResults.inspectionPassFail.pass / analytics.advancedResults.inspectionPassFail.total) * 100 : 0}%` }}
                            >
                              {analytics.advancedResults.inspectionPassFail.pass > 0 && analytics.advancedResults.inspectionPassFail.pass}
                            </div>
                            <div
                              className="bg-red-500 h-full transition-all duration-500 flex items-center justify-center text-xs font-medium text-white"
                              style={{ width: `${analytics.advancedResults.inspectionPassFail.total > 0 ? (analytics.advancedResults.inspectionPassFail.fail / analytics.advancedResults.inspectionPassFail.total) * 100 : 0}%` }}
                            >
                              {analytics.advancedResults.inspectionPassFail.fail > 0 && analytics.advancedResults.inspectionPassFail.fail}
                            </div>
                          </div>
                        </div>

                        {/* Histogram Bar */}
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-purple-400">Histogram</span>
                            <span className="text-text-muted">{analytics.advancedResults.histogramPassFail.total} total</span>
                          </div>
                          <div className="h-8 bg-primary rounded-lg overflow-hidden flex">
                            <div
                              className="bg-green-500 h-full transition-all duration-500 flex items-center justify-center text-xs font-medium text-white"
                              style={{ width: `${analytics.advancedResults.histogramPassFail.total > 0 ? (analytics.advancedResults.histogramPassFail.pass / analytics.advancedResults.histogramPassFail.total) * 100 : 0}%` }}
                            >
                              {analytics.advancedResults.histogramPassFail.pass > 0 && analytics.advancedResults.histogramPassFail.pass}
                            </div>
                            <div
                              className="bg-red-500 h-full transition-all duration-500 flex items-center justify-center text-xs font-medium text-white"
                              style={{ width: `${analytics.advancedResults.histogramPassFail.total > 0 ? (analytics.advancedResults.histogramPassFail.fail / analytics.advancedResults.histogramPassFail.total) * 100 : 0}%` }}
                            >
                              {analytics.advancedResults.histogramPassFail.fail > 0 && analytics.advancedResults.histogramPassFail.fail}
                            </div>
                          </div>
                        </div>

                        {/* Overall Bar */}
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-amber-400">Overall</span>
                            <span className="text-text-muted">{analytics.advancedResults.overallResult.total} total</span>
                          </div>
                          <div className="h-8 bg-primary rounded-lg overflow-hidden flex">
                            <div
                              className="bg-green-500 h-full transition-all duration-500 flex items-center justify-center text-xs font-medium text-white"
                              style={{ width: `${analytics.advancedResults.overallResult.total > 0 ? (analytics.advancedResults.overallResult.pass / analytics.advancedResults.overallResult.total) * 100 : 0}%` }}
                            >
                              {analytics.advancedResults.overallResult.pass > 0 && analytics.advancedResults.overallResult.pass}
                            </div>
                            <div
                              className="bg-red-500 h-full transition-all duration-500 flex items-center justify-center text-xs font-medium text-white"
                              style={{ width: `${analytics.advancedResults.overallResult.total > 0 ? (analytics.advancedResults.overallResult.fail / analytics.advancedResults.overallResult.total) * 100 : 0}%` }}
                            >
                              {analytics.advancedResults.overallResult.fail > 0 && analytics.advancedResults.overallResult.fail}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-green-500"></div>
                          <span className="text-text-secondary text-sm">Pass</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-red-500"></div>
                          <span className="text-text-secondary text-sm">Fail</span>
                        </div>
                      </div>
                    </div>

                    {/* Correlation Matrix */}
                    <div className="bg-primary-lighter rounded-xl p-6">
                      <h4 className="text-white font-semibold mb-4">Inspection vs Histogram Correlation</h4>
                      {analytics.advancedResults.correlation.bothPass + analytics.advancedResults.correlation.bothFail + analytics.advancedResults.correlation.inspectionPassHistogramFail + analytics.advancedResults.correlation.inspectionFailHistogramPass === 0 ? (
                        <div className="flex items-center justify-center h-48 text-text-muted">
                          No correlation data available
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* 2x2 Matrix */}
                          <div className="grid grid-cols-3 gap-2 text-center">
                            {/* Header Row */}
                            <div></div>
                            <div className="text-text-muted text-xs font-medium py-2">Histogram Pass</div>
                            <div className="text-text-muted text-xs font-medium py-2">Histogram Fail</div>

                            {/* Inspection Pass Row */}
                            <div className="text-text-muted text-xs font-medium py-4 text-right pr-2">Inspection Pass</div>
                            <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/30">
                              <p className="text-green-400 text-2xl font-bold">{analytics.advancedResults.correlation.bothPass}</p>
                              <p className="text-green-400/70 text-xs">Both Pass</p>
                            </div>
                            <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-500/30">
                              <p className="text-yellow-400 text-2xl font-bold">{analytics.advancedResults.correlation.inspectionPassHistogramFail}</p>
                              <p className="text-yellow-400/70 text-xs">Disagreement</p>
                            </div>

                            {/* Inspection Fail Row */}
                            <div className="text-text-muted text-xs font-medium py-4 text-right pr-2">Inspection Fail</div>
                            <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-500/30">
                              <p className="text-yellow-400 text-2xl font-bold">{analytics.advancedResults.correlation.inspectionFailHistogramPass}</p>
                              <p className="text-yellow-400/70 text-xs">Disagreement</p>
                            </div>
                            <div className="bg-red-500/20 rounded-lg p-4 border border-red-500/30">
                              <p className="text-red-400 text-2xl font-bold">{analytics.advancedResults.correlation.bothFail}</p>
                              <p className="text-red-400/70 text-xs">Both Fail</p>
                            </div>
                          </div>

                          {/* Insights */}
                          <div className="mt-4 p-3 bg-primary rounded-lg">
                            <p className="text-text-secondary text-sm">
                              <span className="text-white font-medium">{analytics.advancedResults.agreementRate.toFixed(1)}%</span> agreement rate between inspection and histogram checks.
                              {analytics.advancedResults.correlation.inspectionPassHistogramFail + analytics.advancedResults.correlation.inspectionFailHistogramPass > 0 && (
                                <span className="text-yellow-400 ml-1">
                                  ({analytics.advancedResults.correlation.inspectionPassHistogramFail + analytics.advancedResults.correlation.inspectionFailHistogramPass} disagreements)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Time Series */}
                  {analytics.advancedResults.timeSeries.length > 0 && (
                    <div className="bg-primary-lighter rounded-xl p-6">
                      <h4 className="text-white font-semibold mb-4">Results Over Time</h4>
                      <div className="space-y-3">
                        {analytics.advancedResults.timeSeries.slice(-12).map((point, idx) => {
                          const inspectionTotal = point.inspectionPass + point.inspectionFail;
                          const histogramTotal = point.histogramPass + point.histogramFail;
                          const overallTotal = point.overallPass + point.overallFail;
                          return (
                            <div key={idx} className="grid grid-cols-4 gap-4 items-center py-2 border-b border-border/50 last:border-0">
                              <div className="text-text-muted text-sm">{point.hour}</div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-primary rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-cyan-400 transition-all"
                                    style={{ width: `${inspectionTotal > 0 ? (point.inspectionPass / inspectionTotal) * 100 : 0}%` }}
                                  ></div>
                                </div>
                                <span className="text-cyan-400 text-xs w-12 text-right">
                                  {inspectionTotal > 0 ? `${((point.inspectionPass / inspectionTotal) * 100).toFixed(0)}%` : '-'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-primary rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-purple-400 transition-all"
                                    style={{ width: `${histogramTotal > 0 ? (point.histogramPass / histogramTotal) * 100 : 0}%` }}
                                  ></div>
                                </div>
                                <span className="text-purple-400 text-xs w-12 text-right">
                                  {histogramTotal > 0 ? `${((point.histogramPass / histogramTotal) * 100).toFixed(0)}%` : '-'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-primary rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-amber-400 transition-all"
                                    style={{ width: `${overallTotal > 0 ? (point.overallPass / overallTotal) * 100 : 0}%` }}
                                  ></div>
                                </div>
                                <span className="text-amber-400 text-xs w-12 text-right">
                                  {overallTotal > 0 ? `${((point.overallPass / overallTotal) * 100).toFixed(0)}%` : '-'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Legend */}
                      <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-cyan-400"></div>
                          <span className="text-text-secondary text-sm">Inspection</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-purple-400"></div>
                          <span className="text-text-secondary text-sm">Histogram</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-amber-400"></div>
                          <span className="text-text-secondary text-sm">Overall</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summary Stats Table */}
                  <div className="bg-primary-lighter rounded-xl p-6">
                    <h4 className="text-white font-semibold mb-4">Detailed Statistics</h4>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-text-muted text-xs font-medium py-3">Metric</th>
                          <th className="text-center text-cyan-400 text-xs font-medium py-3">Inspection</th>
                          <th className="text-center text-purple-400 text-xs font-medium py-3">Histogram</th>
                          <th className="text-center text-amber-400 text-xs font-medium py-3">Overall</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        <tr>
                          <td className="py-3 text-text-secondary">Pass Count</td>
                          <td className="py-3 text-center text-white font-medium">{analytics.advancedResults.inspectionPassFail.pass}</td>
                          <td className="py-3 text-center text-white font-medium">{analytics.advancedResults.histogramPassFail.pass}</td>
                          <td className="py-3 text-center text-white font-medium">{analytics.advancedResults.overallResult.pass}</td>
                        </tr>
                        <tr>
                          <td className="py-3 text-text-secondary">Fail Count</td>
                          <td className="py-3 text-center text-white font-medium">{analytics.advancedResults.inspectionPassFail.fail}</td>
                          <td className="py-3 text-center text-white font-medium">{analytics.advancedResults.histogramPassFail.fail}</td>
                          <td className="py-3 text-center text-white font-medium">{analytics.advancedResults.overallResult.fail}</td>
                        </tr>
                        <tr>
                          <td className="py-3 text-text-secondary">Total</td>
                          <td className="py-3 text-center text-white font-medium">{analytics.advancedResults.inspectionPassFail.total}</td>
                          <td className="py-3 text-center text-white font-medium">{analytics.advancedResults.histogramPassFail.total}</td>
                          <td className="py-3 text-center text-white font-medium">{analytics.advancedResults.overallResult.total}</td>
                        </tr>
                        <tr>
                          <td className="py-3 text-text-secondary">Pass Rate</td>
                          <td className="py-3 text-center">
                            <span className={`font-medium ${analytics.advancedResults.inspectionPassFail.passRate >= 90 ? 'text-green-400' : analytics.advancedResults.inspectionPassFail.passRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {analytics.advancedResults.inspectionPassFail.total > 0 ? `${analytics.advancedResults.inspectionPassFail.passRate.toFixed(1)}%` : 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <span className={`font-medium ${analytics.advancedResults.histogramPassFail.passRate >= 90 ? 'text-green-400' : analytics.advancedResults.histogramPassFail.passRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {analytics.advancedResults.histogramPassFail.total > 0 ? `${analytics.advancedResults.histogramPassFail.passRate.toFixed(1)}%` : 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <span className={`font-medium ${analytics.advancedResults.overallResult.passRate >= 90 ? 'text-green-400' : analytics.advancedResults.overallResult.passRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {analytics.advancedResults.overallResult.total > 0 ? `${analytics.advancedResults.overallResult.passRate.toFixed(1)}%` : 'N/A'}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
