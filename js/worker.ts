/// <reference lib="webworker" />

import init, { read_image_metadata, init_logging, crop_image, resize_image } from '../wasm/pkg/wasm.js';
import type { WorkerResponse, WorkerRequest, ImageMetadata } from './types';

let wasmInitialized = false;

async function initializeWasm() {
    if (wasmInitialized) return;
    try {
        await init();
        init_logging();
        wasmInitialized = true;
    } catch (error) {
        console.error('Worker: Failed to initialize WASM:', error);
        throw error;
    }
}

interface WasmImageMetadata {
    format: string;
    width: number;
    height: number;
    color_type: string;
    bits_per_pixel: number;
    has_alpha: boolean;
    aspect_ratio: number;
    exif_orientation?: number;
    camera_make?: string;
    camera_model?: string;
    date_taken?: string;
}

function mapWasmMetadata(metadata: WasmImageMetadata): ImageMetadata {
    return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        colorType: metadata.color_type,
        bitsPerPixel: metadata.bits_per_pixel,
        hasAlpha: metadata.has_alpha,
        aspectRatio: metadata.aspect_ratio,
        exifOrientation: metadata.exif_orientation,
        cameraMake: metadata.camera_make,
        cameraModel: metadata.camera_model,
        dateTaken: metadata.date_taken,
    };
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    try {
        await initializeWasm();

        const request = event.data;
        const data = new Uint8Array(request.data);

        if (request.action === 'crop') {
            const { x, y, width, height } = request.params;
            const croppedData = crop_image(data, x, y, width, height);
            const metadata = read_image_metadata(croppedData) as WasmImageMetadata;
            
            const croppedBuffer = croppedData.buffer as ArrayBuffer;
            const response: WorkerResponse = {
                success: true,
                metadata: mapWasmMetadata(metadata),
                croppedImage: croppedBuffer
            };
            self.postMessage(response, [croppedBuffer]);
        } else if (request.action === 'resize') {
            const { width, height, filter } = request.params;
            const resizedData = resize_image(data, width, height, filter);
            const metadata = read_image_metadata(resizedData) as WasmImageMetadata;

            const resizedBuffer = resizedData.buffer as ArrayBuffer;
            const response: WorkerResponse = {
                success: true,
                metadata: mapWasmMetadata(metadata),
                resizedImage: resizedBuffer
            };
            self.postMessage(response, [resizedBuffer]);
        } else {
            const metadata = read_image_metadata(data) as WasmImageMetadata;

            const response: WorkerResponse = {
                success: true,
                metadata: mapWasmMetadata(metadata)
            };
            self.postMessage(response);
        }
    } catch (error) {
        const action = event.data?.action ?? 'unknown';
        console.error(`Worker error [${action}]:`, error);
        const response: WorkerResponse = {
            success: false,
            error: `[${action}] ${error instanceof Error ? error.message : String(error)}`
        };
        self.postMessage(response);
    }
};
