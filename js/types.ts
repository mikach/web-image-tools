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

export type WorkerRequest = MetadataRequest | CropRequest | ResizeRequest | RotateRequest;

export interface WorkerSuccessResponse {
  success: true;
  metadata: ImageMetadata;
  croppedImage?: ArrayBuffer;
  resizedImage?: ArrayBuffer;
  rotatedImage?: ArrayBuffer;
}

export interface WorkerErrorResponse {
  success: false;
  error: string;
}

export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;
