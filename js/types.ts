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

export type WorkerRequest = MetadataRequest | CropRequest | ResizeRequest;

export interface WorkerSuccessResponse {
  success: true;
  metadata: ImageMetadata;
  croppedImage?: ArrayBuffer;
  resizedImage?: ArrayBuffer;
}

export interface WorkerErrorResponse {
  success: false;
  error: string;
}

export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;
