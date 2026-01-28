import type { WorkerResponse, WorkerRequest, ImageMetadata } from './types';

// Constants
const MIN_CROP_SIZE = 10;
const INITIAL_CROP_RATIO = 0.8;

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
let currentFileName = '';
let currentImageBuffer: ArrayBuffer | null = null;

// DOM Elements
const filePicker = document.getElementById('file-picker') as HTMLInputElement;
const uploadSection = document.getElementById('upload-section') as HTMLDivElement;
const dropzoneView = document.getElementById('dropzone-view') as HTMLElement;
const resultView = document.getElementById('result-view') as HTMLElement;
const resultContainer = document.getElementById('result-container') as HTMLDivElement;
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const fileNameEl = document.getElementById('file-name') as HTMLHeadingElement;
const changeImageBtn = document.getElementById('change-image-btn') as HTMLButtonElement;
const cropBtn = document.getElementById('crop-btn') as HTMLButtonElement;
const cropDoneBtn = document.getElementById('crop-done-btn') as HTMLButtonElement;
const cropCancelBtn = document.getElementById('crop-cancel-btn') as HTMLButtonElement;
const cropOverlay = document.getElementById('crop-overlay') as HTMLDivElement;
const cropSelection = document.getElementById('crop-selection') as HTMLDivElement;
const previewActions = document.querySelector('.preview-actions') as HTMLDivElement;
const cropActions = document.getElementById('crop-actions') as HTMLDivElement;

let isCropping = false;
let cropData = { x: 0, y: 0, width: 0, height: 0 };

// Interaction state
let isDragging = false;
let isResizing = false;
let activeHandle: string | null = null;
let startX = 0;
let startY = 0;
let startCropData = { x: 0, y: 0, width: 0, height: 0 };

function showDropzoneView() {
    dropzoneView.classList.remove('hidden');
    resultView.classList.add('hidden');
}

function showResultView() {
    dropzoneView.classList.add('hidden');
    resultView.classList.remove('hidden');
}

function setButtonsDisabled(disabled: boolean) {
    cropBtn.disabled = disabled;
    changeImageBtn.disabled = disabled;
}

async function processFile(file: File) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        resultContainer.innerHTML = '<p style="color: hsl(var(--destructive));">Invalid file type. Please select an image file.</p>';
        showResultView();
        return;
    }

    currentFileSize = file.size;
    currentFileName = file.name;
    
    // Show result view with loading state
    fileNameEl.textContent = currentFileName;
    resultContainer.innerHTML = '<p class="text-muted">Processing image...</p>';
    setButtonsDisabled(true);
    
    // Create image preview
    const objectUrl = URL.createObjectURL(file);
    imagePreview.src = objectUrl;
    imagePreview.onload = () => {
        URL.revokeObjectURL(objectUrl);
    };
    imagePreview.onerror = () => {
        URL.revokeObjectURL(objectUrl);
    };
    
    showResultView();

    try {
        const arrayBuffer = await file.arrayBuffer();
        currentImageBuffer = arrayBuffer.slice(0); // Keep a copy for cropping
        
        const request: WorkerRequest = {
            action: 'metadata',
            data: arrayBuffer
        };
        
        worker.postMessage(request, [request.data]);
    } catch (error) {
        resultContainer.innerHTML = `<p style="color: hsl(var(--destructive));">Error reading file: ${error}</p>`;
    }
}

// File picker change
filePicker.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
        processFile(file);
    }
});

// Upload section click
uploadSection.addEventListener('click', () => {
    filePicker.click();
});

// Change image button
changeImageBtn.addEventListener('click', () => {
    filePicker.click();
});

// Crop button
cropBtn.addEventListener('click', () => {
    startCropping();
});

// Crop Done button
cropDoneBtn.addEventListener('click', () => {
    finishCropping(true);
});

// Crop Cancel button
cropCancelBtn.addEventListener('click', () => {
    finishCropping(false);
});

function startCropping() {
    isCropping = true;
    cropOverlay.classList.remove('hidden');
    previewActions.classList.add('hidden');
    cropActions.classList.remove('hidden');

    // Initialize crop selection to percentage of image size
    const imgWidth = imagePreview.clientWidth;
    const imgHeight = imagePreview.clientHeight;
    
    const selWidth = imgWidth * INITIAL_CROP_RATIO;
    const selHeight = imgHeight * INITIAL_CROP_RATIO;
    const selX = (imgWidth - selWidth) / 2;
    const selY = (imgHeight - selHeight) / 2;

    updateCropSelection(selX, selY, selWidth, selHeight);
}

function finishCropping(apply: boolean) {
    isCropping = false;
    cropOverlay.classList.add('hidden');
    previewActions.classList.remove('hidden');
    cropActions.classList.add('hidden');

    if (apply) {
        // Calculate natural coordinates
        const scaleX = imagePreview.naturalWidth / imagePreview.clientWidth;
        const scaleY = imagePreview.naturalHeight / imagePreview.clientHeight;

        const naturalCrop = {
            x: Math.round(cropData.x * scaleX),
            y: Math.round(cropData.y * scaleY),
            width: Math.round(cropData.width * scaleX),
            height: Math.round(cropData.height * scaleY)
        };

        if (!currentImageBuffer) {
            resultContainer.innerHTML = '<p style="color: hsl(var(--destructive));">No image loaded.</p>';
            return;
        }

        const request: WorkerRequest = {
            action: 'crop',
            data: currentImageBuffer.slice(0),
            params: naturalCrop
        };

        resultContainer.innerHTML = '<p class="text-muted">Cropping image...</p>';
        setButtonsDisabled(true);
        worker.postMessage(request, [request.data]);
    }
}

function updateCropSelection(x: number, y: number, width: number, height: number) {
    const imgWidth = imagePreview.clientWidth;
    const imgHeight = imagePreview.clientHeight;

    // Constrain to image boundaries
    x = Math.max(0, Math.min(x, imgWidth - MIN_CROP_SIZE));
    y = Math.max(0, Math.min(y, imgHeight - MIN_CROP_SIZE));
    width = Math.max(MIN_CROP_SIZE, Math.min(width, imgWidth - x));
    height = Math.max(MIN_CROP_SIZE, Math.min(height, imgHeight - y));

    cropData = { x, y, width, height };

    cropSelection.style.left = `${x}px`;
    cropSelection.style.top = `${y}px`;
    cropSelection.style.width = `${width}px`;
    cropSelection.style.height = `${height}px`;
}

// Interactive Selection Logic
cropSelection.addEventListener('mousedown', (e) => {
    if (!isCropping) return;
    e.stopPropagation();
    
    const target = e.target as HTMLElement;
    if (target.classList.contains('crop-handle')) {
        isResizing = true;
        activeHandle = target.getAttribute('data-handle');
    } else {
        isDragging = true;
    }

    startX = e.clientX;
    startY = e.clientY;
    startCropData = { ...cropData };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
});

function handleMouseMove(e: MouseEvent) {
    if (!isDragging && !isResizing) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (isDragging) {
        updateCropSelection(
            startCropData.x + dx,
            startCropData.y + dy,
            startCropData.width,
            startCropData.height
        );
    } else if (isResizing && activeHandle) {
        let { x, y, width, height } = startCropData;

        switch (activeHandle) {
            case 'nw':
                x += dx;
                y += dy;
                width -= dx;
                height -= dy;
                break;
            case 'ne':
                y += dy;
                width += dx;
                height -= dy;
                break;
            case 'sw':
                x += dx;
                width -= dx;
                height += dy;
                break;
            case 'se':
                width += dx;
                height += dy;
                break;
        }

        updateCropSelection(x, y, width, height);
    }
}

function handleMouseUp() {
    isDragging = false;
    isResizing = false;
    activeHandle = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
}

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

// Also allow drop on the whole document when in dropzone view
document.addEventListener('dragover', (event) => {
    if (!dropzoneView.classList.contains('hidden')) {
        event.preventDefault();
        uploadSection.classList.add('drag-over');
    }
});

document.addEventListener('dragleave', (event) => {
    if (!dropzoneView.classList.contains('hidden') && !event.relatedTarget) {
        uploadSection.classList.remove('drag-over');
    }
});

document.addEventListener('drop', (event) => {
    if (!dropzoneView.classList.contains('hidden')) {
        event.preventDefault();
        uploadSection.classList.remove('drag-over');
        
        const file = event.dataTransfer?.files?.[0];
        if (file) {
            processFile(file);
        }
    }
});

worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;

    if (response.success) {
        const { metadata } = response;
        
        if ('croppedImage' in response && response.croppedImage) {
            currentImageBuffer = response.croppedImage.slice(0);
            currentFileSize = response.croppedImage.byteLength;
            
            const format = metadata.format.toLowerCase();
            const mimeType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
            const blob = new Blob([response.croppedImage], { type: mimeType });
            const objectUrl = URL.createObjectURL(blob);
            imagePreview.src = objectUrl;
            imagePreview.onload = () => {
                URL.revokeObjectURL(objectUrl);
            };
            imagePreview.onerror = () => {
                URL.revokeObjectURL(objectUrl);
            };
        }

        resultContainer.innerHTML = `
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
                <span class="metadata-value">${metadata.width} × ${metadata.height}</span>
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
        setButtonsDisabled(false);
    } else {
        resultContainer.innerHTML = `<p style="color: hsl(var(--destructive));">Error processing image: ${response.error}</p>`;
        setButtonsDisabled(false);
    }
};

worker.onerror = (error) => {
    console.error('Worker error:', error);
    resultContainer.innerHTML = `<p style="color: hsl(var(--destructive));">Worker error occurred.</p>`;
    setButtonsDisabled(false);
};
