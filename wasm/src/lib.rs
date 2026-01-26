use wasm_bindgen::prelude::*;
use image::ImageReader;
use std::io::Cursor;

#[wasm_bindgen]
pub fn init_logging() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen(getter_with_clone)]
pub struct ImageMetadata {
    pub format: String,
    pub width: u32,
    pub height: u32,
    pub color_type: String,
}

#[wasm_bindgen]
pub fn read_image_metadata(data: &[u8]) -> Result<ImageMetadata, String> {
    let reader = ImageReader::new(Cursor::new(data))
        .with_guessed_format()
        .map_err(|e| format!("Failed to identify format: {}", e))?;

    let format = reader.format()
        .map(|f| format!("{:?}", f))
        .unwrap_or_else(|| "Unknown".to_string());

    let img = reader.decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    Ok(ImageMetadata {
        format,
        width: img.width(),
        height: img.height(),
        color_type: format!("{:?}", img.color()),
    })
}