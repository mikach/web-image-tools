import type { WorkerResponse } from './types';

// Initialize worker using Vite's worker loader
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module'
});

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

let currentFileSize = 0;

const filePicker = document.getElementById('file-picker') as HTMLInputElement;
const resultContainer = document.getElementById('result-container') as HTMLDivElement;
const uploadSection = document.querySelector('.upload-section') as HTMLDivElement;

async function processFile(file: File) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        resultContainer.innerHTML = '<p style="color: hsl(var(--destructive));">Invalid file type. Please select an image file.</p>';
        return;
    }

    currentFileSize = file.size;
    resultContainer.innerHTML = '<p>Processing image...</p>';

    try {
        const arrayBuffer = await file.arrayBuffer();
        // Send to worker, transfer the buffer to avoid copying
        worker.postMessage(arrayBuffer, [arrayBuffer]);
    } catch (error) {
        resultContainer.innerHTML = `<p style="color: red;">Error reading file: ${error}</p>`;
    }
}

filePicker.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
        processFile(file);
    }
});

uploadSection.addEventListener('click', () => {
    filePicker.click();
});

// Drag and drop event listeners
uploadSection.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.stopPropagation();
    uploadSection.classList.add('drag-over');
});

uploadSection.addEventListener('dragleave', (event) => {
    event.preventDefault();
    event.stopPropagation();
    uploadSection.classList.remove('drag-over');
});

uploadSection.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    uploadSection.classList.remove('drag-over');

    const file = event.dataTransfer?.files?.[0];
    if (file) {
        processFile(file);
    }
});

worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;

    if (response.success) {
        const { metadata } = response;
        resultContainer.innerHTML = `
            <h3 style="margin-top: 0; margin-bottom: 1rem; font-size: 1rem; font-weight: 600;">Image Metadata</h3>
            <div class="metadata-item">
                <span class="metadata-label">Format</span>
                <span class="metadata-value">${metadata.format}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">File Size</span>
                <span class="metadata-value">${formatFileSize(currentFileSize)}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Dimensions</span>
                <span class="metadata-value">${metadata.width} x ${metadata.height}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Color Type</span>
                <span class="metadata-value">${metadata.colorType}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Bits Per Pixel</span>
                <span class="metadata-value">${metadata.bitsPerPixel}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Has Alpha</span>
                <span class="metadata-value">${metadata.hasAlpha ? 'Yes' : 'No'}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Aspect Ratio</span>
                <span class="metadata-value">${metadata.aspectRatio.toFixed(2)}</span>
            </div>
        `;
    } else {
        resultContainer.innerHTML = `<p style="color: red;">Error processing image: ${response.error}</p>`;
    }
};

worker.onerror = (error) => {
    console.error('Worker error:', error);
    resultContainer.innerHTML = `<p style="color: red;">Worker error occurred.</p>`;
};

console.log('Main script initialized');
