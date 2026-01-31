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
export const rotateLeftBtn = getElement<HTMLButtonElement>('rotate-left-btn');
export const rotateRightBtn = getElement<HTMLButtonElement>('rotate-right-btn');
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

// Adjust elements
export const adjustBtn = getElement<HTMLButtonElement>('adjust-btn');
export const adjustControls = getElement<HTMLDivElement>('adjust-controls');

// Adjust sliders
export const adjustBrightnessInput = getElement<HTMLInputElement>('adjust-brightness');
export const adjustBrightnessValue = getElement<HTMLSpanElement>('adjust-brightness-value');
export const adjustContrastInput = getElement<HTMLInputElement>('adjust-contrast');
export const adjustContrastValue = getElement<HTMLSpanElement>('adjust-contrast-value');
export const adjustExposureInput = getElement<HTMLInputElement>('adjust-exposure');
export const adjustExposureValue = getElement<HTMLSpanElement>('adjust-exposure-value');
export const adjustGammaInput = getElement<HTMLInputElement>('adjust-gamma');
export const adjustGammaValue = getElement<HTMLSpanElement>('adjust-gamma-value');
export const adjustSaturationInput = getElement<HTMLInputElement>('adjust-saturation');
export const adjustSaturationValue = getElement<HTMLSpanElement>('adjust-saturation-value');
export const adjustHueInput = getElement<HTMLInputElement>('adjust-hue');
export const adjustHueValue = getElement<HTMLSpanElement>('adjust-hue-value');
export const adjustVibranceInput = getElement<HTMLInputElement>('adjust-vibrance');
export const adjustVibranceValue = getElement<HTMLSpanElement>('adjust-vibrance-value');
export const adjustShadowsInput = getElement<HTMLInputElement>('adjust-shadows');
export const adjustShadowsValue = getElement<HTMLSpanElement>('adjust-shadows-value');
export const adjustHighlightsInput = getElement<HTMLInputElement>('adjust-highlights');
export const adjustHighlightsValue = getElement<HTMLSpanElement>('adjust-highlights-value');

// Adjust action buttons
export const adjustApplyBtn = getElement<HTMLButtonElement>('adjust-apply-btn');
export const adjustCancelBtn = getElement<HTMLButtonElement>('adjust-cancel-btn');
export const adjustResetBtn = getElement<HTMLButtonElement>('adjust-reset-btn');
