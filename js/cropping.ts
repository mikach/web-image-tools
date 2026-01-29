import type { CropParams } from './types';
import { imagePreview, cropSelectionEl } from './dom';

export const MIN_CROP_SIZE = 10;
export const INITIAL_CROP_RATIO = 0.8;

interface CropInteractionState {
    isDragging: boolean;
    isResizing: boolean;
    activeHandle: string | null;
    startX: number;
    startY: number;
    startCropData: CropParams;
}

const interaction: CropInteractionState = {
    isDragging: false,
    isResizing: false,
    activeHandle: null,
    startX: 0,
    startY: 0,
    startCropData: { x: 0, y: 0, width: 0, height: 0 },
};

export function getInitialCropSelection(): CropParams {
    const imgWidth = imagePreview.clientWidth;
    const imgHeight = imagePreview.clientHeight;
    
    const selWidth = imgWidth * INITIAL_CROP_RATIO;
    const selHeight = imgHeight * INITIAL_CROP_RATIO;
    const selX = (imgWidth - selWidth) / 2;
    const selY = (imgHeight - selHeight) / 2;

    return constrainCropSelection(selX, selY, selWidth, selHeight);
}

export function constrainCropSelection(x: number, y: number, width: number, height: number): CropParams {
    const imgWidth = imagePreview.clientWidth;
    const imgHeight = imagePreview.clientHeight;

    x = Math.max(0, Math.min(x, imgWidth - MIN_CROP_SIZE));
    y = Math.max(0, Math.min(y, imgHeight - MIN_CROP_SIZE));
    width = Math.max(MIN_CROP_SIZE, Math.min(width, imgWidth - x));
    height = Math.max(MIN_CROP_SIZE, Math.min(height, imgHeight - y));

    return { x, y, width, height };
}

export function getNaturalCropCoordinates(cropSelection: CropParams): CropParams {
    const scaleX = imagePreview.naturalWidth / imagePreview.clientWidth;
    const scaleY = imagePreview.naturalHeight / imagePreview.clientHeight;

    return {
        x: Math.round(cropSelection.x * scaleX),
        y: Math.round(cropSelection.y * scaleY),
        width: Math.round(cropSelection.width * scaleX),
        height: Math.round(cropSelection.height * scaleY)
    };
}

export function setupCropInteraction(onUpdate: (crop: CropParams) => void): void {
    cropSelectionEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        
        const target = e.target as HTMLElement;
        if (target.classList.contains('crop-handle')) {
            interaction.isResizing = true;
            interaction.activeHandle = target.getAttribute('data-handle');
        } else {
            interaction.isDragging = true;
        }

        interaction.startX = e.clientX;
        interaction.startY = e.clientY;
        
        interaction.startCropData = {
            x: parseFloat(cropSelectionEl.style.left) || 0,
            y: parseFloat(cropSelectionEl.style.top) || 0,
            width: parseFloat(cropSelectionEl.style.width) || 0,
            height: parseFloat(cropSelectionEl.style.height) || 0,
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!interaction.isDragging && !interaction.isResizing) return;

            const dx = e.clientX - interaction.startX;
            const dy = e.clientY - interaction.startY;

            if (interaction.isDragging) {
                onUpdate(constrainCropSelection(
                    interaction.startCropData.x + dx,
                    interaction.startCropData.y + dy,
                    interaction.startCropData.width,
                    interaction.startCropData.height
                ));
            } else if (interaction.isResizing && interaction.activeHandle) {
                let { x, y, width, height } = interaction.startCropData;

                switch (interaction.activeHandle) {
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

                onUpdate(constrainCropSelection(x, y, width, height));
            }
        };

        const handleMouseUp = () => {
            interaction.isDragging = false;
            interaction.isResizing = false;
            interaction.activeHandle = null;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });
}
