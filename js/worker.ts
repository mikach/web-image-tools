/// <reference lib="webworker" />

import init, { read_image_metadata, init_logging, crop_image } from '../wasm/pkg/wasm.js';
import type { WorkerResponse, WorkerRequest } from './types';

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

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    try {
        await initializeWasm();

        const { action, data: buffer, params: cropParams } = event.data;
        const data = new Uint8Array(buffer);

        if (action === 'crop' && cropParams) {
            const croppedData = crop_image(data, cropParams.x, cropParams.y, cropParams.width, cropParams.height);
            const metadata = read_image_metadata(croppedData);
            
            const croppedBuffer = croppedData.buffer as ArrayBuffer;
            const response: WorkerResponse = {
                success: true,
                metadata: {
                    format: metadata.format,
                    width: metadata.width,
                    height: metadata.height,
                    colorType: metadata.color_type,
                    bitsPerPixel: metadata.bits_per_pixel,
                    hasAlpha: metadata.has_alpha,
                    aspectRatio: metadata.aspect_ratio
                },
                croppedImage: croppedBuffer
            };
            self.postMessage(response, [croppedBuffer]);
        } else {
            const metadata = read_image_metadata(data);

            const response: WorkerResponse = {
                success: true,
                metadata: {
                    format: metadata.format,
                    width: metadata.width,
                    height: metadata.height,
                    colorType: metadata.color_type,
                    bitsPerPixel: metadata.bits_per_pixel,
                    hasAlpha: metadata.has_alpha,
                    aspectRatio: metadata.aspect_ratio
                }
            };
            self.postMessage(response);
        }
    } catch (error) {
        console.error('Worker error:', error);
        const response: WorkerResponse = {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
        self.postMessage(response);
    }
};
