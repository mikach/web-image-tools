import type { AdjustParams } from './types';
import * as dom from './dom';

export function getDefaultAdjustParams(): AdjustParams {
    return {
        brightness: 0,
        contrast: 0,
        saturation: 100,
        hue: 0,
        exposure: 0,
        gamma: 100,
        shadows: 0,
        highlights: 0,
        vibrance: 0,
    };
}

function updateSliderValueDisplay(
    input: HTMLInputElement,
    display: HTMLSpanElement,
    formatter: (value: number) => string = String
): void {
    display.textContent = formatter(parseInt(input.value));
}

function formatGamma(value: number): string {
    return (value / 100).toFixed(1);
}

function formatHue(value: number): string {
    return `${value}°`;
}

export function resetSliders(): void {
    const defaults = getDefaultAdjustParams();
    
    dom.adjustBrightnessInput.value = String(defaults.brightness);
    dom.adjustBrightnessValue.textContent = String(defaults.brightness);
    
    dom.adjustContrastInput.value = String(defaults.contrast);
    dom.adjustContrastValue.textContent = String(defaults.contrast);
    
    dom.adjustExposureInput.value = String(defaults.exposure);
    dom.adjustExposureValue.textContent = String(defaults.exposure);
    
    dom.adjustGammaInput.value = String(defaults.gamma);
    dom.adjustGammaValue.textContent = formatGamma(defaults.gamma);
    
    dom.adjustSaturationInput.value = String(defaults.saturation);
    dom.adjustSaturationValue.textContent = String(defaults.saturation);
    
    dom.adjustHueInput.value = String(defaults.hue);
    dom.adjustHueValue.textContent = formatHue(defaults.hue);
    
    dom.adjustVibranceInput.value = String(defaults.vibrance);
    dom.adjustVibranceValue.textContent = String(defaults.vibrance);
    
    dom.adjustShadowsInput.value = String(defaults.shadows);
    dom.adjustShadowsValue.textContent = String(defaults.shadows);
    
    dom.adjustHighlightsInput.value = String(defaults.highlights);
    dom.adjustHighlightsValue.textContent = String(defaults.highlights);
}

export function getCurrentAdjustParams(): AdjustParams {
    return {
        brightness: parseInt(dom.adjustBrightnessInput.value),
        contrast: parseInt(dom.adjustContrastInput.value),
        saturation: parseInt(dom.adjustSaturationInput.value),
        hue: parseInt(dom.adjustHueInput.value),
        exposure: parseInt(dom.adjustExposureInput.value),
        gamma: parseInt(dom.adjustGammaInput.value),
        shadows: parseInt(dom.adjustShadowsInput.value),
        highlights: parseInt(dom.adjustHighlightsInput.value),
        vibrance: parseInt(dom.adjustVibranceInput.value),
    };
}

export function setupAdjustmentSliders(onUpdate: (params: AdjustParams) => void): void {
    // Helper to create input handler
    const createHandler = (
        input: HTMLInputElement,
        display: HTMLSpanElement,
        formatter: (value: number) => string = String
    ) => {
        return () => {
            updateSliderValueDisplay(input, display, formatter);
            onUpdate(getCurrentAdjustParams());
        };
    };

    // Tone sliders
    dom.adjustBrightnessInput.addEventListener('input', 
        createHandler(dom.adjustBrightnessInput, dom.adjustBrightnessValue));
    
    dom.adjustContrastInput.addEventListener('input',
        createHandler(dom.adjustContrastInput, dom.adjustContrastValue));
    
    dom.adjustExposureInput.addEventListener('input',
        createHandler(dom.adjustExposureInput, dom.adjustExposureValue));
    
    dom.adjustGammaInput.addEventListener('input',
        createHandler(dom.adjustGammaInput, dom.adjustGammaValue, formatGamma));

    // Color sliders
    dom.adjustSaturationInput.addEventListener('input',
        createHandler(dom.adjustSaturationInput, dom.adjustSaturationValue));
    
    dom.adjustHueInput.addEventListener('input',
        createHandler(dom.adjustHueInput, dom.adjustHueValue, formatHue));
    
    dom.adjustVibranceInput.addEventListener('input',
        createHandler(dom.adjustVibranceInput, dom.adjustVibranceValue));

    // Light sliders
    dom.adjustShadowsInput.addEventListener('input',
        createHandler(dom.adjustShadowsInput, dom.adjustShadowsValue));
    
    dom.adjustHighlightsInput.addEventListener('input',
        createHandler(dom.adjustHighlightsInput, dom.adjustHighlightsValue));
}
