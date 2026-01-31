use wasm_bindgen::prelude::*;
use image::{DynamicImage, ImageFormat, ImageReader};
use std::io::Cursor;
use exif::{In, Tag};

#[wasm_bindgen]
pub fn init_logging() {
    console_error_panic_hook::set_once();
}

struct DecodedImage {
    img: DynamicImage,
    format: ImageFormat,
    format_name: String,
}

fn decode_image(data: &[u8]) -> Result<DecodedImage, String> {
    let reader = ImageReader::new(Cursor::new(data))
        .with_guessed_format()
        .map_err(|e| format!("Failed to identify format: {}", e))?;

    let format = reader.format().unwrap_or(ImageFormat::Png);
    let format_name = format!("{:?}", format);

    let img = reader.decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    Ok(DecodedImage { img, format, format_name })
}

struct ExifData {
    orientation: Option<u32>,
    camera_make: Option<String>,
    camera_model: Option<String>,
    date_taken: Option<String>,
}

fn get_exif_string(exif: &exif::Exif, tag: Tag) -> Option<String> {
    exif.get_field(tag, In::PRIMARY)
        .map(|f| f.display_value().to_string().trim_matches('"').to_string())
}

fn extract_exif_data(data: &[u8]) -> ExifData {
    let mut exif_data = ExifData {
        orientation: None,
        camera_make: None,
        camera_model: None,
        date_taken: None,
    };

    let exif_reader = match exif::Reader::new().read_from_container(&mut Cursor::new(data)) {
        Ok(reader) => reader,
        Err(_) => return exif_data,
    };

    if let Some(field) = exif_reader.get_field(Tag::Orientation, In::PRIMARY) {
        if let Some(val) = field.value.get_uint(0) {
            exif_data.orientation = Some(val);
        }
    }

    exif_data.camera_make = get_exif_string(&exif_reader, Tag::Make);
    exif_data.camera_model = get_exif_string(&exif_reader, Tag::Model);
    exif_data.date_taken = get_exif_string(&exif_reader, Tag::DateTimeOriginal);

    exif_data
}

#[wasm_bindgen(getter_with_clone)]
pub struct ImageMetadata {
    pub format: String,
    pub width: u32,
    pub height: u32,
    pub color_type: String,
    pub bits_per_pixel: u16,
    pub has_alpha: bool,
    pub aspect_ratio: f64,
    pub exif_orientation: Option<u32>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub date_taken: Option<String>,
}

#[wasm_bindgen]
pub fn read_image_metadata(data: &[u8]) -> Result<ImageMetadata, String> {
    let decoded = decode_image(data)?;
    let color = decoded.img.color();
    
    let exif = extract_exif_data(data);
    
    Ok(ImageMetadata {
        format: decoded.format_name,
        width: decoded.img.width(),
        height: decoded.img.height(),
        color_type: format!("{:?}", color),
        bits_per_pixel: color.bits_per_pixel(),
        has_alpha: color.has_alpha(),
        aspect_ratio: decoded.img.width() as f64 / decoded.img.height() as f64,
        exif_orientation: exif.orientation,
        camera_make: exif.camera_make,
        camera_model: exif.camera_model,
        date_taken: exif.date_taken,
    })
}

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
