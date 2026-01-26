import init, { read_image_metadata, init_logging } from '../wasm/pkg/wasm.js';

let wasmInitialized = false;

async function initializeWasm() {
    if (wasmInitialized) return;
    try {
        await init();
        init_logging();
        wasmInitialized = true;
        console.log('WASM initialized in worker');
    } catch (error) {
        console.error('Failed to initialize WASM:', error);
        throw error;
    }
}

self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
    try {
        await initializeWasm();
        
        const data = new Uint8Array(event.data);
        const metadata = read_image_metadata(data);
        
        self.postMessage({
            success: true,
            metadata: {
                format: metadata.format,
                width: metadata.width,
                height: metadata.height,
                colorType: metadata.color_type
            }
        });
    } catch (error) {
        self.postMessage({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
