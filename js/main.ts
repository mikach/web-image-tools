import type { WorkerResponse, ImageMetadata, MetadataRequest, CropRequest, CropParams, ResizeRequest, ResizeParams, RotateRequest, RotateDirection } from './types';
import * as dom from './dom';
import { 
    getInitialCropSelection, 
    constrainCropSelection, 
    getNaturalCropCoordinates,
    setupCropInteraction 
} from './cropping';
import {
    initResizeState,
    setupResizeInputs
} from './resizing';

const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module'
});

interface AppState {
    view: 'dropzone' | 'result';
    isProcessing: boolean;
    isCropping: boolean;
    isResizing: boolean;
    currentImage: {
        buffer: ArrayBuffer;
        metadata: ImageMetadata | null;
        fileName: string;
        fileSize: number;
    } | null;
    cropSelection: CropParams;
    resizeParams: ResizeParams;
}

let state: AppState = {
    view: 'dropzone',
    isProcessing: false,
    isCropping: false,
    isResizing: false,
    currentImage: null,
    cropSelection: { x: 0, y: 0, width: 0, height: 0 },
    resizeParams: { width: 0, height: 0, filter: 'lanczos3', maintainAspectRatio: true },
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
    const items = [
        renderMetadataItem('Format', metadata.format),
        renderMetadataItem('File Size', formatFileSize(fileSize)),
        renderMetadataItem('Dimensions', `${metadata.width} × ${metadata.height}`),
        renderMetadataItem('Color Type', metadata.colorType),
        renderMetadataItem('Bits Per Pixel', String(metadata.bitsPerPixel)),
        renderMetadataItem('Has Alpha', metadata.hasAlpha ? 'Yes' : 'No'),
        renderMetadataItem('Aspect Ratio', metadata.aspectRatio.toFixed(2)),
    ];

    if (metadata.cameraMake || metadata.cameraModel) {
        const camera = [metadata.cameraMake, metadata.cameraModel].filter(Boolean).join(' ');
        items.push(renderMetadataItem('Camera', camera));
    }

    if (metadata.dateTaken) {
        items.push(renderMetadataItem('Date Taken', metadata.dateTaken));
    }

    return items.join('');
}

function renderState() {
    if (state.view === 'dropzone') {
        dom.dropzoneView.classList.remove('hidden');
        dom.resultView.classList.add('hidden');
    } else {
        dom.dropzoneView.classList.add('hidden');
        dom.resultView.classList.remove('hidden');
    }

    dom.cropBtn.disabled = state.isProcessing;
    dom.rotateLeftBtn.disabled = state.isProcessing;
    dom.rotateRightBtn.disabled = state.isProcessing;
    dom.resizeBtn.disabled = state.isProcessing;
    dom.changeImageBtn.disabled = state.isProcessing;

    if (state.isCropping) {
        dom.cropOverlay.classList.remove('hidden');
        dom.previewActions.classList.add('hidden');
        dom.cropActions.classList.remove('hidden');
        dom.resizeControls.classList.add('hidden');
    } else if (state.isResizing) {
        dom.cropOverlay.classList.add('hidden');
        dom.previewActions.classList.add('hidden');
        dom.cropActions.classList.add('hidden');
        dom.resizeControls.classList.remove('hidden');
    } else {
        dom.cropOverlay.classList.add('hidden');
        dom.previewActions.classList.remove('hidden');
        dom.cropActions.classList.add('hidden');
        dom.resizeControls.classList.add('hidden');
    }

    dom.cropSelectionEl.style.left = `${state.cropSelection.x}px`;
    dom.cropSelectionEl.style.top = `${state.cropSelection.y}px`;
    dom.cropSelectionEl.style.width = `${state.cropSelection.width}px`;
    dom.cropSelectionEl.style.height = `${state.cropSelection.height}px`;

    if (state.isCropping && state.currentImage?.metadata) {
        const natural = getNaturalCropCoordinates(state.cropSelection);
        const w = Math.round(natural.width);
        const h = Math.round(natural.height);
        dom.cropDimensionsEl.textContent = `${w} × ${h} px`;
    }

    if (state.currentImage) {
        dom.fileNameEl.textContent = state.currentImage.fileName;
    }

    if (state.currentImage?.metadata) {
        dom.resultContainer.innerHTML = renderMetadata(
            state.currentImage.metadata,
            state.currentImage.fileSize
        );
    }
}

async function processFile(file: File) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        dom.resultContainer.innerHTML = '<p style="color: hsl(var(--destructive));">Invalid file type. Please select an image file.</p>';
        setState({ view: 'result' });
        return;
    }

    dom.resultContainer.innerHTML = '<p class="text-muted">Processing image...</p>';
    
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
        dom.resultContainer.innerHTML = `<p style="color: hsl(var(--destructive));">Error reading file: ${error}</p>`;
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
            dom.resultContainer.innerHTML = '<p style="color: hsl(var(--destructive));">No image loaded.</p>';
            return;
        }

        const naturalCrop = getNaturalCropCoordinates(state.cropSelection);

        const request: CropRequest = {
            action: 'crop',
            data: state.currentImage.buffer.slice(0),
            params: naturalCrop
        };

        dom.resultContainer.innerHTML = '<p class="text-muted">Cropping image...</p>';
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
            dom.resultContainer.innerHTML = '<p style="color: hsl(var(--destructive));">No image loaded.</p>';
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

        dom.resultContainer.innerHTML = '<p class="text-muted">Resizing image...</p>';
        setState({ isProcessing: true });
        worker.postMessage(request, [request.data]);
    }
}

function updateResizeParams(params: Partial<ResizeParams>) {
    setState({ resizeParams: { ...state.resizeParams, ...params } });
}

function rotateImage(direction: RotateDirection) {
    if (!state.currentImage?.buffer) {
        dom.resultContainer.innerHTML = '<p style="color: hsl(var(--destructive));">No image loaded.</p>';
        return;
    }

    const request: RotateRequest = {
        action: 'rotate',
        data: state.currentImage.buffer.slice(0),
        direction
    };

    dom.resultContainer.innerHTML = '<p class="text-muted">Rotating image...</p>';
    setState({ isProcessing: true });
    worker.postMessage(request, [request.data]);
}

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

dom.changeImageBtn.addEventListener('click', () => {
    dom.filePicker.click();
});

dom.cropBtn.addEventListener('click', () => {
    startCropping();
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
    startResizing();
});

dom.resizeApplyBtn.addEventListener('click', () => {
    finishResizing(true);
});

dom.resizeCancelBtn.addEventListener('click', () => {
    finishResizing(false);
});

setupResizeInputs(updateResizeParams);

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
        dom.resultContainer.innerHTML = `<p style="color: hsl(var(--destructive));">Error processing image: ${response.error}</p>`;
        setState({ isProcessing: false });
    }
};

worker.onerror = (error) => {
    console.error('Worker error:', error);
    dom.resultContainer.innerHTML = `<p style="color: hsl(var(--destructive));">Worker error occurred.</p>`;
    setState({ isProcessing: false });
};
