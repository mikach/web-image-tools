use wasm_bindgen::prelude::*;
use std::io::Cursor;

use crate::common::decode_image;

#[wasm_bindgen]
pub fn crop_image(data: &[u8], x: u32, y: u32, width: u32, height: u32) -> Result<Vec<u8>, String> {
    let decoded = decode_image(data)?;

    if x + width > decoded.img.width() || y + height > decoded.img.height() {
        return Err(format!(
            "Crop region ({},{} {}x{}) exceeds image bounds ({}x{})",
            x, y, width, height, decoded.img.width(), decoded.img.height()
        ));
    }

    let cropped = decoded.img.crop_imm(x, y, width, height);

    let mut output = Vec::new();
    cropped.write_to(&mut Cursor::new(&mut output), decoded.format)
        .map_err(|e| format!("Failed to encode cropped image: {}", e))?;

    Ok(output)
}

#[wasm_bindgen]
pub fn resize_image(
    data: &[u8],
    new_width: u32,
    new_height: u32,
    filter: &str
) -> Result<Vec<u8>, String> {
    let decoded = decode_image(data)?;

    let filter_type = match filter {
        "nearest" => image::imageops::FilterType::Nearest,
        "triangle" => image::imageops::FilterType::Triangle,
        "catmull_rom" => image::imageops::FilterType::CatmullRom,
        "gaussian" => image::imageops::FilterType::Gaussian,
        _ => image::imageops::FilterType::Lanczos3,
    };

    let resized = decoded.img.resize_exact(new_width, new_height, filter_type);

    let mut output = Vec::new();
    resized.write_to(&mut Cursor::new(&mut output), decoded.format)
        .map_err(|e| format!("Failed to encode resized image: {}", e))?;

    Ok(output)
}

#[wasm_bindgen]
pub fn rotate_image(data: &[u8], direction: &str) -> Result<Vec<u8>, String> {
    let decoded = decode_image(data)?;

    let rotated = match direction {
        "left" => decoded.img.rotate270(),   // 270° = 90° counter-clockwise
        "right" => decoded.img.rotate90(),   // 90° = 90° clockwise
        _ => return Err("Invalid rotation direction".to_string()),
    };

    let mut output = Vec::new();
    rotated.write_to(&mut Cursor::new(&mut output), decoded.format)
        .map_err(|e| format!("Failed to encode rotated image: {}", e))?;

    Ok(output)
}
