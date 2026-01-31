function getElement<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Required element #${id} not found`);
    return el as T;
}

function querySelector<T extends Element>(selector: string): T {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Required element ${selector} not found`);
    return el as T;
}

export const filePicker = getElement<HTMLInputElement>('file-picker');
export const uploadSection = getElement<HTMLDivElement>('upload-section');
export const dropzoneView = getElement<HTMLElement>('dropzone-view');
export const resultView = getElement<HTMLElement>('result-view');
export const resultContainer = getElement<HTMLDivElement>('result-container');
export const imagePreview = getElement<HTMLImageElement>('image-preview');
export const fileNameEl = getElement<HTMLHeadingElement>('file-name');
export const changeImageBtn = getElement<HTMLButtonElement>('change-image-btn');
export const cropBtn = getElement<HTMLButtonElement>('crop-btn');
export const cropDoneBtn = getElement<HTMLButtonElement>('crop-done-btn');
export const cropCancelBtn = getElement<HTMLButtonElement>('crop-cancel-btn');
export const cropOverlay = getElement<HTMLDivElement>('crop-overlay');
export const cropSelectionEl = getElement<HTMLDivElement>('crop-selection');
export const cropDimensionsEl = getElement<HTMLDivElement>('crop-dimensions');
export const previewActions = querySelector<HTMLDivElement>('.preview-actions');
export const cropActions = getElement<HTMLDivElement>('crop-actions');

// Resize elements
export const resizeBtn = getElement<HTMLButtonElement>('resize-btn');
export const resizeControls = getElement<HTMLDivElement>('resize-controls');
export const resizeWidthInput = getElement<HTMLInputElement>('resize-width');
export const resizeHeightInput = getElement<HTMLInputElement>('resize-height');
export const maintainRatioCheckbox = getElement<HTMLInputElement>('maintain-ratio');
export const resizeFilterSelect = getElement<HTMLSelectElement>('resize-filter');
export const resizeApplyBtn = getElement<HTMLButtonElement>('resize-apply-btn');
export const resizeCancelBtn = getElement<HTMLButtonElement>('resize-cancel-btn');
