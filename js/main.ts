// Initialize worker using Vite's worker loader
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module'
});

const filePicker = document.getElementById('file-picker') as HTMLInputElement;
const resultContainer = document.getElementById('result-container') as HTMLDivElement;

filePicker.addEventListener('change', async (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file) return;

    resultContainer.innerHTML = '<p>Processing image...</p>';

    try {
        const arrayBuffer = await file.arrayBuffer();
        // Send to worker, transfer the buffer to avoid copying
        worker.postMessage(arrayBuffer, [arrayBuffer]);
    } catch (error) {
        resultContainer.innerHTML = `<p style="color: red;">Error reading file: ${error}</p>`;
    }
});

worker.onmessage = (event) => {
    const { success, metadata, error } = event.data;

    if (success) {
        resultContainer.innerHTML = `
            <h3>Image Metadata</h3>
            <div class="metadata-item">
                <span class="metadata-label">Format:</span>
                <span>${metadata.format}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Dimensions:</span>
                <span>${metadata.width} x ${metadata.height}</span>
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Color Type:</span>
                <span>${metadata.colorType}</span>
            </div>
        `;
    } else {
        resultContainer.innerHTML = `<p style="color: red;">Error processing image: ${error}</p>`;
    }
};

worker.onerror = (error) => {
    console.error('Worker error:', error);
    resultContainer.innerHTML = `<p style="color: red;">Worker error occurred.</p>`;
};

console.log('Main script initialized');
