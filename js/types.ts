export interface ImageMetadata {
  format: string;
  width: number;
  height: number;
  colorType: string;
  bitsPerPixel: number;
  hasAlpha: boolean;
  aspectRatio: number;
  exifOrientation?: number;
  cameraMake?: string;
  cameraModel?: string;
  dateTaken?: string;
  iso?: number;
  aperture?: string;
  shutterSpeed?: string;
  focalLength?: string;
  flash?: string;
  lensModel?: string;
  software?: string;
  exposureProgram?: string;
}

export interface CropParams {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResizeFilter = 'nearest' | 'triangle' | 'catmull_rom' | 'gaussian' | 'lanczos3';

export interface ResizeParams {
  width: number;
  height: number;
  filter: ResizeFilter;
  maintainAspectRatio: boolean;
}

export interface MetadataRequest {
  action: 'metadata';
  data: ArrayBuffer;
}

export interface CropRequest {
  action: 'crop';
  data: ArrayBuffer;
  params: CropParams;
}

export interface ResizeRequest {
  action: 'resize';
  data: ArrayBuffer;
  params: ResizeParams;
}

export type RotateDirection = 'left' | 'right';

export interface RotateRequest {
  action: 'rotate';
  data: ArrayBuffer;
  direction: RotateDirection;
}

export interface AdjustParams {
  brightness: number;   // -100 to +100
  contrast: number;     // -100 to +100
  saturation: number;   // 0 to 200 (100 = original, maps to 0-2)
  hue: number;          // -180 to +180
  exposure: number;     // -200 to +200 (maps to -2.0 to +2.0 stops)
  gamma: number;        // 10 to 300 (maps to 0.1 to 3.0)
  shadows: number;      // -100 to +100
  highlights: number;   // -100 to +100
  vibrance: number;     // -100 to +100
}

export interface AdjustRequest {
  action: 'adjust';
  data: ArrayBuffer;
  params: AdjustParams;
}

export type WorkerRequest = MetadataRequest | CropRequest | ResizeRequest | RotateRequest | AdjustRequest;

export interface WorkerSuccessResponse {
  success: true;
  metadata: ImageMetadata;
  croppedImage?: ArrayBuffer;
  resizedImage?: ArrayBuffer;
  rotatedImage?: ArrayBuffer;
  adjustedImage?: ArrayBuffer;
}

export interface WorkerErrorResponse {
  success: false;
  error: string;
}

export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;
