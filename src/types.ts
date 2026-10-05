export type DetectionKind = 'ai' | 'edited' | 'camera' | 'unknown';


export interface AnalysisProgress {
  percent: number;
  stage: 'reading' | 'metadata' | 'provenance' | 'detection' | 'complete';
  label: string;
  detail?: string;
}

export interface DetectionMatch {
  source: string;
  marker: string;
  weight: number;
  detail?: string;
}

export interface DetectedTool {
  name: string;
  version?: string;
  mode?: 'generation' | 'edit' | 'upscale' | 'unknown';
}

export interface GenerationDetails {
  positivePrompt?: string;
  negativePrompt?: string;
  steps?: string;
  sampler?: string;
  cfgScale?: string;
  seed?: string;
  size?: string;
  model?: string;
  denoisingStrength?: string;
  aspectRatio?: string;
  generatorVersion?: string;
  style?: string;
  jobId?: string;
  workflowNodeCount?: number;
  workflow?: unknown;
}

export interface EditHistoryEvent {
  action: string;
  title: string;
  description?: string;
  when?: string;
  software?: string;
  digitalSourceType?: string;
  aiRelated?: boolean;
}

export interface C2paSummary {
  present: boolean;
  activeManifest?: string;
  claimGenerator?: string;
  validationState?: string;
  signatureIssuer?: string;
  signedAt?: string;
  digitalSourceTypes: string[];
  actions: EditHistoryEvent[];
  raw?: Record<string, unknown>;
  error?: string;
}

export interface DetectionResult {
  kind: DetectionKind;
  confidence: number;
  title: string;
  description: string;
  matches: DetectionMatch[];
  tool?: DetectedTool;
}

export interface MetadataSection {
  title: string;
  entries: Array<{ label: string; value: string }>;
}

export interface GpsData {
  latitude: number;
  longitude: number;
}

export interface ImageAnalysis {
  fileName: string;
  fileType: string;
  fileSize: number;
  width?: number;
  height?: number;
  previewUrl: string;
  detection: DetectionResult;
  sections: MetadataSection[];
  raw: Record<string, unknown>;
  gps?: GpsData;
  binaryMarkers: string[];
  generation?: GenerationDetails;
  editHistory: EditHistoryEvent[];
  c2pa?: C2paSummary;
  isDemo?: boolean;
}

export type SanitizerMode = 'full' | 'ai-only';
export type SanitizerFormat = 'original' | 'png' | 'jpeg' | 'webp';

export interface SanitizerOptions {
  mode: SanitizerMode;
  format: SanitizerFormat;
  quality: number;
}

export interface SanitizerResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  originalSize: number;
  cleanedSize: number;
  removedItems: string[];
  lossless: boolean;
  pixelDataPreserved: boolean;
  outputWidth?: number;
  outputHeight?: number;
  note?: string;
}
