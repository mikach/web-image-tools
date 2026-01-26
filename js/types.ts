export interface ImageMetadata {
  format: string;
  width: number;
  height: number;
  colorType: string;
  bitsPerPixel: number;
  hasAlpha: boolean;
  aspectRatio: number;
}

export interface WorkerSuccessResponse {
  success: true;
  metadata: ImageMetadata;
}

export interface WorkerErrorResponse {
  success: false;
  error: string;
}

export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;
