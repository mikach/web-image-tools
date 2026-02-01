import type { WorkerResponse, ImageMetadata, MetadataRequest, CropRequest, CropParams, ResizeRequest, ResizeParams, RotateRequest, RotateDirection, AdjustParams, AdjustRequest } from './types';
import * as dom from './dom';
import { 
    getInitialCropSelection, 
    getNaturalCropCoordinates,
    setupCropInteraction 
} from './cropping';
import {
    initResizeState,
    setupResizeInputs
} from './resizing';
import {
    getDefaultAdjustParams,
    resetSliders,
    setupAdjustmentSliders
} from './adjustments';

// Theme management
function initTheme(): void {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add('dark');
    }
}

function toggleTheme(): void {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Initialize theme immediately
initTheme();

const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module'
});

interface AppState {
    view: 'dropzone' | 'result';
    isProcessing: boolean;
    isCropping: boolean;
    isResizing: boolean;
    isAdjusting: boolean;
    currentImage: {
        buffer: ArrayBuffer;
        metadata: ImageMetadata | null;
        fileName: string;
        fileSize: number;
    } | null;
    cropSelection: CropParams;
    resizeParams: ResizeParams;
    adjustParams: AdjustParams;
}

let state: AppState = {
    view: 'dropzone',
    isProcessing: false,
    isCropping: false,
    isResizing: false,
    isAdjusting: false,
    currentImage: null,
    cropSelection: { x: 0, y: 0, width: 0, height: 0 },
    resizeParams: { width: 0, height: 0, filter: 'lanczos3', maintainAspectRatio: true },
    adjustParams: getDefaultAdjustParams(),
};

function setState(updates: Partial<AppState>) {
    state = { ...state, ...updates };
    renderState();
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

let activeObjectUrl: string | null = null;

function setImagePreview(url: string): void {
    if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = url;
    dom.imagePreview.src = url;
}

function renderMetadataItem(label: string, value: string): string {
    return `<div class="metadata-item">
        <span class="metadata-label">${label}</span>
        <span class="metadata-value">${value}</span>
    </div>`;
}

function renderMetadata(metadata: ImageMetadata, fileSize: number): string {
    const items: string[] = [];

    // Basic info
    items.push(renderMetadataItem('Format', metadata.format));
    items.push(renderMetadataItem('Dimensions', `${metadata.width} × ${metadata.height}`));
    items.push(renderMetadataItem('File Size', formatFileSize(fileSize)));
    items.push(renderMetadataItem('Color Type', metadata.colorType));
    items.push(renderMetadataItem('Bits/Pixel', String(metadata.bitsPerPixel)));
    items.push(renderMetadataItem('Alpha', metadata.hasAlpha ? 'Yes' : 'No'));
    items.push(renderMetadataItem('Aspect Ratio', metadata.aspectRatio.toFixed(2)));

    // Camera info
    if (metadata.cameraMake || metadata.cameraModel) {
        const camera = [metadata.cameraMake, metadata.cameraModel].filter(Boolean).join(' ');
        items.push(renderMetadataItem('Camera', camera));
    }

    if (metadata.lensModel) {
        items.push(renderMetadataItem('Lens', metadata.lensModel));
    }

    if (metadata.dateTaken) {
        items.push(renderMetadataItem('Date Taken', metadata.dateTaken));
    }

    // Exposure settings
    if (metadata.iso) {
        items.push(renderMetadataItem('ISO', String(metadata.iso)));
    }

    if (metadata.aperture) {
        items.push(renderMetadataItem('Aperture', metadata.aperture));
    }

    if (metadata.shutterSpeed) {
        items.push(renderMetadataItem('Shutter', metadata.shutterSpeed));
    }

    if (metadata.focalLength) {
        items.push(renderMetadataItem('Focal Length', metadata.focalLength));
    }

    if (metadata.exposureProgram) {
        items.push(renderMetadataItem('Exposure', metadata.exposureProgram));
    }

    if (metadata.flash) {
        items.push(renderMetadataItem('Flash', metadata.flash));
    }

    if (metadata.software) {
        items.push(renderMetadataItem('Software', metadata.software));
    }

    return items.join('');
}

function renderState() {
    // Toggle views
    if (state.view === 'dropzone') {
        dom.dropzoneView.classList.remove('hidden');
        dom.resultView.classList.add('hidden');
        dom.fileNameEl.textContent = 'Web Image Tools';
    } else {
        dom.dropzoneView.classList.add('hidden');
        dom.resultView.classList.remove('hidden');
    }

    // Update filename in header
    if (state.currentImage) {
        dom.fileNameEl.textContent = state.currentImage.fileName;
    }

    // Update info bar and details
    if (state.currentImage?.metadata) {
        const { metadata } = state.currentImage;
        dom.imageDimensionsEl.textContent = `${metadata.width} × ${metadata.height}`;
        dom.imageFormatEl.textContent = metadata.format;
        dom.imageSizeEl.textContent = formatFileSize(state.currentImage.fileSize);
        dom.infoDetailsContent.innerHTML = renderMetadata(metadata, state.currentImage.fileSize);
        dom.infoToggleBtn.style.display = '';
    } else {
        dom.imageDimensionsEl.textContent = '--';
        dom.imageFormatEl.textContent = '--';
        dom.imageSizeEl.textContent = '--';
        dom.infoDetailsContent.innerHTML = '';
        dom.infoToggleBtn.style.display = 'none';
    }

    // Update button states
    const toolsDisabled = state.isProcessing || state.isCropping || state.isResizing || state.isAdjusting;
    dom.cropBtn.disabled = toolsDisabled;
    dom.rotateLeftBtn.disabled = toolsDisabled;
    dom.rotateRightBtn.disabled = toolsDisabled;
    dom.resizeBtn.disabled = toolsDisabled;
    dom.adjustBtn.disabled = toolsDisabled;
    dom.changeImageBtn.disabled = state.isProcessing;
    dom.saveBtn.disabled = state.isProcessing || !state.currentImage;

    // Update active states on tool buttons
    dom.cropBtn.classList.toggle('active', state.isCropping);
    dom.resizeBtn.classList.toggle('active', state.isResizing);
    dom.adjustBtn.classList.toggle('active', state.isAdjusting);

    // Toggle tool panels
    if (state.isCropping) {
        dom.cropOverlay.classList.remove('hidden');
        dom.cropActions.classList.remove('hidden');
        dom.resizeControls.classList.add('hidden');
        dom.adjustControls.classList.add('hidden');
    } else if (state.isResizing) {
        dom.cropOverlay.classList.add('hidden');
        dom.cropActions.classList.add('hidden');
        dom.resizeControls.classList.remove('hidden');
        dom.adjustControls.classList.add('hidden');
    } else if (state.isAdjusting) {
        dom.cropOverlay.classList.add('hidden');
        dom.cropActions.classList.add('hidden');
        dom.resizeControls.classList.add('hidden');
        dom.adjustControls.classList.remove('hidden');
    } else {
        dom.cropOverlay.classList.add('hidden');
        dom.cropActions.classList.add('hidden');
        dom.resizeControls.classList.add('hidden');
        dom.adjustControls.classList.add('hidden');
    }

    // Update crop selection position
    dom.cropSelectionEl.style.left = `${state.cropSelection.x}px`;
    dom.cropSelectionEl.style.top = `${state.cropSelection.y}px`;
    dom.cropSelectionEl.style.width = `${state.cropSelection.width}px`;
    dom.cropSelectionEl.style.height = `${state.cropSelection.height}px`;

    // Update crop dimensions display
    if (state.isCropping && state.currentImage?.metadata) {
        const natural = getNaturalCropCoordinates(state.cropSelection);
        const w = Math.round(natural.width);
        const h = Math.round(natural.height);
        dom.cropDimensionsEl.textContent = `${w} × ${h} px`;
    }
}

async function processFile(file: File) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        console.error('Invalid file type. Please select an image file.');
        return;
    }

    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);

    try {
        const arrayBuffer = await file.arrayBuffer();
        
        setState({
            view: 'result',
            isProcessing: true,
            currentImage: {
                buffer: arrayBuffer.slice(0),
                metadata: null,
                fileName: file.name,
                fileSize: file.size,
            },
        });
        
        const request: MetadataRequest = {
            action: 'metadata',
            data: arrayBuffer
        };
        
        worker.postMessage(request, [request.data]);
    } catch (error) {
        console.error('Error reading file:', error);
        setState({ isProcessing: false });
    }
}

function startCropping() {
    setState({
        isCropping: true,
        cropSelection: getInitialCropSelection(),
    });
}

function finishCropping(apply: boolean) {
    setState({ isCropping: false });

    if (apply) {
        if (!state.currentImage?.buffer) {
            console.error('No image loaded.');
            return;
        }

        const naturalCrop = getNaturalCropCoordinates(state.cropSelection);

        const request: CropRequest = {
            action: 'crop',
            data: state.currentImage.buffer.slice(0),
            params: naturalCrop
        };

        setState({ isProcessing: true });
        worker.postMessage(request, [request.data]);
    }
}

function updateCropSelection(crop: CropParams) {
    setState({ cropSelection: crop });
}

function startResizing() {
    const metadata = state.currentImage?.metadata;
    if (!metadata) return;

    initResizeState(metadata.width, metadata.height);
    setState({
        isResizing: true,
        resizeParams: {
            width: metadata.width,
            height: metadata.height,
            filter: 'lanczos3',
            maintainAspectRatio: true,
        },
    });
}

function finishResizing(apply: boolean) {
    setState({ isResizing: false });

    if (apply) {
        if (!state.currentImage?.buffer) {
            console.error('No image loaded.');
            return;
        }

        const request: ResizeRequest = {
            action: 'resize',
            data: state.currentImage.buffer.slice(0),
            params: {
                width: state.resizeParams.width,
                height: state.resizeParams.height,
                filter: state.resizeParams.filter,
                maintainAspectRatio: state.resizeParams.maintainAspectRatio,
            }
        };

        setState({ isProcessing: true });
        worker.postMessage(request, [request.data]);
    }
}

function updateResizeParams(params: Partial<ResizeParams>) {
    setState({ resizeParams: { ...state.resizeParams, ...params } });
}

function rotateImage(direction: RotateDirection) {
    if (!state.currentImage?.buffer) {
        console.error('No image loaded.');
        return;
    }

    const request: RotateRequest = {
        action: 'rotate',
        data: state.currentImage.buffer.slice(0),
        direction
    };

    setState({ isProcessing: true });
    worker.postMessage(request, [request.data]);
}

function startAdjusting() {
    resetSliders();
    setState({
        isAdjusting: true,
        adjustParams: getDefaultAdjustParams(),
    });
}

function finishAdjusting(apply: boolean) {
    setState({ isAdjusting: false });

    if (apply) {
        if (!state.currentImage?.buffer) {
            console.error('No image loaded.');
            return;
        }

        const request: AdjustRequest = {
            action: 'adjust',
            data: state.currentImage.buffer.slice(0),
            params: state.adjustParams
        };

        setState({ isProcessing: true });
        worker.postMessage(request, [request.data]);
    }
}

function updateAdjustParams(params: AdjustParams) {
    setState({ adjustParams: params });
}

function saveImage() {
    if (!state.currentImage?.buffer) return;

    const metadata = state.currentImage.metadata;
    const format = metadata?.format.toLowerCase() ?? 'png';
    const mimeType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;

    const blob = new Blob([state.currentImage.buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = state.currentImage.fileName;
    a.click();

    URL.revokeObjectURL(url);
}

// Event listeners
dom.filePicker.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
        processFile(file);
    }
});

dom.uploadSection.addEventListener('click', () => {
    dom.filePicker.click();
});

document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

dom.saveBtn.addEventListener('click', saveImage);

dom.infoToggleBtn.addEventListener('click', () => {
    const isExpanded = dom.infoDetails.classList.toggle('hidden');
    dom.infoToggleBtn.classList.toggle('expanded', !isExpanded);
});

dom.changeImageBtn.addEventListener('click', () => {
    dom.filePicker.click();
});

dom.cropBtn.addEventListener('click', () => {
    if (state.isCropping) {
        finishCropping(false);
    } else {
        startCropping();
    }
});

dom.rotateLeftBtn.addEventListener('click', () => {
    rotateImage('left');
});

dom.rotateRightBtn.addEventListener('click', () => {
    rotateImage('right');
});

dom.cropDoneBtn.addEventListener('click', () => {
    finishCropping(true);
});

dom.cropCancelBtn.addEventListener('click', () => {
    finishCropping(false);
});

setupCropInteraction(updateCropSelection);

dom.resizeBtn.addEventListener('click', () => {
    if (state.isResizing) {
        finishResizing(false);
    } else {
        startResizing();
    }
});

dom.resizeApplyBtn.addEventListener('click', () => {
    finishResizing(true);
});

dom.resizeCancelBtn.addEventListener('click', () => {
    finishResizing(false);
});

setupResizeInputs(updateResizeParams);

dom.adjustBtn.addEventListener('click', () => {
    if (state.isAdjusting) {
        finishAdjusting(false);
    } else {
        startAdjusting();
    }
});

dom.adjustApplyBtn.addEventListener('click', () => {
    finishAdjusting(true);
});

dom.adjustCancelBtn.addEventListener('click', () => {
    finishAdjusting(false);
});

dom.adjustResetBtn.addEventListener('click', () => {
    resetSliders();
    setState({ adjustParams: getDefaultAdjustParams() });
});

setupAdjustmentSliders(updateAdjustParams);

// Drag and drop handlers
dom.uploadSection.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dom.uploadSection.classList.add('drag-over');
});

dom.uploadSection.addEventListener('dragleave', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dom.uploadSection.classList.remove('drag-over');
});

dom.uploadSection.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dom.uploadSection.classList.remove('drag-over');

    const file = event.dataTransfer?.files?.[0];
    if (file) {
        processFile(file);
    }
});

document.addEventListener('dragover', (event) => {
    if (state.view === 'dropzone') {
        event.preventDefault();
        dom.uploadSection.classList.add('drag-over');
    }
});

document.addEventListener('dragleave', (event) => {
    if (state.view === 'dropzone' && !event.relatedTarget) {
        dom.uploadSection.classList.remove('drag-over');
    }
});

document.addEventListener('drop', (event) => {
    if (state.view === 'dropzone') {
        event.preventDefault();
        dom.uploadSection.classList.remove('drag-over');
        
        const file = event.dataTransfer?.files?.[0];
        if (file) {
            processFile(file);
        }
    }
});

// Worker message handler
worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;

    if (response.success) {
        const { metadata } = response;
        
        if ('croppedImage' in response && response.croppedImage) {
            const format = metadata.format.toLowerCase();
            const mimeType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
            const blob = new Blob([response.croppedImage], { type: mimeType });
            const objectUrl = URL.createObjectURL(blob);
            setImagePreview(objectUrl);

            setState({
                isProcessing: false,
                currentImage: state.currentImage ? {
                    ...state.currentImage,
                    buffer: response.croppedImage.slice(0),
                    fileSize: response.croppedImage.byteLength,
                    metadata,
                } : null,
            });
        } else if ('resizedImage' in response && response.resizedImage) {
            const format = metadata.format.toLowerCase();
            const mimeType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
            const blob = new Blob([response.resizedImage], { type: mimeType });
            const objectUrl = URL.createObjectURL(blob);
            setImagePreview(objectUrl);

            setState({
                isProcessing: false,
                currentImage: state.currentImage ? {
                    ...state.currentImage,
                    buffer: response.resizedImage.slice(0),
                    fileSize: response.resizedImage.byteLength,
                    metadata,
                } : null,
            });
        } else if ('rotatedImage' in response && response.rotatedImage) {
            const format = metadata.format.toLowerCase();
            const mimeType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
            const blob = new Blob([response.rotatedImage], { type: mimeType });
            const objectUrl = URL.createObjectURL(blob);
            setImagePreview(objectUrl);

            setState({
                isProcessing: false,
                currentImage: state.currentImage ? {
                    ...state.currentImage,
                    buffer: response.rotatedImage.slice(0),
                    fileSize: response.rotatedImage.byteLength,
                    metadata,
                } : null,
            });
        } else if ('adjustedImage' in response && response.adjustedImage) {
            const format = metadata.format.toLowerCase();
            const mimeType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
            const blob = new Blob([response.adjustedImage], { type: mimeType });
            const objectUrl = URL.createObjectURL(blob);
            setImagePreview(objectUrl);

            setState({
                isProcessing: false,
                currentImage: state.currentImage ? {
                    ...state.currentImage,
                    buffer: response.adjustedImage.slice(0),
                    fileSize: response.adjustedImage.byteLength,
                    metadata,
                } : null,
            });
        } else {
            setState({
                isProcessing: false,
                currentImage: state.currentImage ? {
                    ...state.currentImage,
                    metadata,
                } : null,
            });
        }
    } else {
        console.error('Error processing image:', response.error);
        setState({ isProcessing: false });
    }
};

worker.onerror = (error) => {
    console.error('Worker error:', error);
    setState({ isProcessing: false });
};
