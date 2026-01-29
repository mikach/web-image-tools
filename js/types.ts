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

export interface MetadataRequest {
  action: 'metadata';
  data: ArrayBuffer;
}

export interface CropRequest {
  action: 'crop';
  data: ArrayBuffer;
  params: CropParams;
}

export type WorkerRequest = MetadataRequest | CropRequest;

export interface WorkerSuccessResponse {
  success: true;
  metadata: ImageMetadata;
  croppedImage?: ArrayBuffer;
}

export interface WorkerErrorResponse {
  success: false;
  error: string;
}

export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;
