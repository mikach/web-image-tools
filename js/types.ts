export interface ImageMetadata {
  format: string;
  width: number;
  height: number;
  colorType: string;
  bitsPerPixel: number;
  hasAlpha: boolean;
  aspectRatio: number;
}

export interface CropParams {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorkerRequest {
  action: 'metadata' | 'crop';
  data: ArrayBuffer;
  params?: CropParams;
}

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
