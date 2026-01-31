import type { ResizeParams, ResizeFilter } from './types';
import * as dom from './dom';

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
    let timeoutId: ReturnType<typeof setTimeout>;
    return ((...args: unknown[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), ms);
    }) as T;
}

const DEBOUNCE_MS = 200;

export const MIN_DIMENSION = 1;
export const MAX_DIMENSION = 16384;

interface ResizeState {
    originalWidth: number;
    originalHeight: number;
    aspectRatio: number;
}

let resizeState: ResizeState = {
    originalWidth: 0,
    originalHeight: 0,
    aspectRatio: 1,
};

export function initResizeState(width: number, height: number): void {
    resizeState = {
        originalWidth: width,
        originalHeight: height,
        aspectRatio: width / height,
    };
    
    dom.resizeWidthInput.value = String(width);
    dom.resizeHeightInput.value = String(height);
}

export function validateDimension(value: number): number {
    return Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, Math.round(value)));
}

export function calculateConstrainedDimension(
    changed: 'width' | 'height',
    value: number,
    maintainRatio: boolean
): { width: number; height: number } {
    const validatedValue = validateDimension(value);

    if (!maintainRatio) {
        if (changed === 'width') {
            return {
                width: validatedValue,
                height: validateDimension(parseInt(dom.resizeHeightInput.value) || resizeState.originalHeight),
            };
        } else {
            return {
                width: validateDimension(parseInt(dom.resizeWidthInput.value) || resizeState.originalWidth),
                height: validatedValue,
            };
        }
    }

    if (changed === 'width') {
        return {
            width: validatedValue,
            height: validateDimension(validatedValue / resizeState.aspectRatio),
        };
    } else {
        return {
            width: validateDimension(validatedValue * resizeState.aspectRatio),
            height: validatedValue,
        };
    }
}

export function setupResizeInputs(onUpdate: (params: Partial<ResizeParams>) => void): void {
    const handleWidthChange = debounce(() => {
        const value = parseInt(dom.resizeWidthInput.value);
        if (isNaN(value)) return;

        const { width, height } = calculateConstrainedDimension(
            'width',
            value,
            dom.maintainRatioCheckbox.checked
        );

        dom.resizeWidthInput.value = String(width);
        dom.resizeHeightInput.value = String(height);
        onUpdate({ width, height });
    }, DEBOUNCE_MS);

    const handleHeightChange = debounce(() => {
        const value = parseInt(dom.resizeHeightInput.value);
        if (isNaN(value)) return;

        const { width, height } = calculateConstrainedDimension(
            'height',
            value,
            dom.maintainRatioCheckbox.checked
        );

        dom.resizeWidthInput.value = String(width);
        dom.resizeHeightInput.value = String(height);
        onUpdate({ width, height });
    }, DEBOUNCE_MS);

    dom.resizeWidthInput.addEventListener('input', handleWidthChange);
    dom.resizeHeightInput.addEventListener('input', handleHeightChange);

    dom.resizeFilterSelect.addEventListener('change', () => {
        onUpdate({ filter: dom.resizeFilterSelect.value as ResizeFilter });
    });

    dom.maintainRatioCheckbox.addEventListener('change', () => {
        onUpdate({ maintainAspectRatio: dom.maintainRatioCheckbox.checked });
    });
}
