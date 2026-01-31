use wasm_bindgen::prelude::*;
use image::{DynamicImage, ImageFormat, ImageReader, Rgba, RgbaImage};
use image::imageops::{brighten, contrast, huerotate};
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
    iso: Option<u32>,
    aperture: Option<String>,
    shutter_speed: Option<String>,
    focal_length: Option<String>,
    flash: Option<String>,
    lens_model: Option<String>,
    software: Option<String>,
    exposure_program: Option<String>,
}

fn get_exif_string(exif: &exif::Exif, tag: Tag) -> Option<String> {
    exif.get_field(tag, In::PRIMARY)
        .map(|f| f.display_value().to_string().trim_matches('"').to_string())
}

fn get_exif_uint(exif: &exif::Exif, tag: Tag) -> Option<u32> {
    exif.get_field(tag, In::PRIMARY)
        .and_then(|f| f.value.get_uint(0))
}

fn format_flash(value: u32) -> String {
    // Flash value is a bitfield: bit 0 = fired, bits 1-2 = return, bits 3-4 = mode
    let fired = (value & 0x01) != 0;
    let mode = (value >> 3) & 0x03;
    
    match (fired, mode) {
        (_, 2) => "Off".to_string(),
        (true, _) => "Fired".to_string(),
        (false, _) => "Did not fire".to_string(),
    }
}

fn format_exposure_program(value: u32) -> String {
    match value {
        0 => "Not defined".to_string(),
        1 => "Manual".to_string(),
        2 => "Normal program".to_string(),
        3 => "Aperture priority".to_string(),
        4 => "Shutter priority".to_string(),
        5 => "Creative program".to_string(),
        6 => "Action program".to_string(),
        7 => "Portrait mode".to_string(),
        8 => "Landscape mode".to_string(),
        _ => format!("Unknown ({})", value),
    }
}

fn extract_exif_data(data: &[u8]) -> ExifData {
    let mut exif_data = ExifData {
        orientation: None,
        camera_make: None,
        camera_model: None,
        date_taken: None,
        iso: None,
        aperture: None,
        shutter_speed: None,
        focal_length: None,
        flash: None,
        lens_model: None,
        software: None,
        exposure_program: None,
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
    
    // ISO - try PhotographicSensitivity first, fall back to ISOSpeedRatings
    exif_data.iso = get_exif_uint(&exif_reader, Tag::PhotographicSensitivity)
        .or_else(|| get_exif_uint(&exif_reader, Tag::ISOSpeed));
    
    // Aperture (FNumber) - format as f/X.X
    if let Some(aperture_str) = get_exif_string(&exif_reader, Tag::FNumber) {
        exif_data.aperture = Some(format!("f/{}", aperture_str));
    }
    
    // Shutter speed (ExposureTime) - already formatted as fraction by display_value
    if let Some(shutter) = get_exif_string(&exif_reader, Tag::ExposureTime) {
        exif_data.shutter_speed = Some(format!("{}s", shutter));
    }
    
    // Focal length - append "mm"
    if let Some(focal) = get_exif_string(&exif_reader, Tag::FocalLength) {
        exif_data.focal_length = Some(format!("{} mm", focal));
    }
    
    // Flash - map to human-readable
    if let Some(flash_val) = get_exif_uint(&exif_reader, Tag::Flash) {
        exif_data.flash = Some(format_flash(flash_val));
    }
    
    // Lens model
    exif_data.lens_model = get_exif_string(&exif_reader, Tag::LensModel);
    
    // Software
    exif_data.software = get_exif_string(&exif_reader, Tag::Software);
    
    // Exposure program - map to human-readable
    if let Some(program_val) = get_exif_uint(&exif_reader, Tag::ExposureProgram) {
        exif_data.exposure_program = Some(format_exposure_program(program_val));
    }

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
    pub iso: Option<u32>,
    pub aperture: Option<String>,
    pub shutter_speed: Option<String>,
    pub focal_length: Option<String>,
    pub flash: Option<String>,
    pub lens_model: Option<String>,
    pub software: Option<String>,
    pub exposure_program: Option<String>,
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
        iso: exif.iso,
        aperture: exif.aperture,
        shutter_speed: exif.shutter_speed,
        focal_length: exif.focal_length,
        flash: exif.flash,
        lens_model: exif.lens_model,
        software: exif.software,
        exposure_program: exif.exposure_program,
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

// ============================================================================
// Image Adjustment Helpers
// ============================================================================

/// Convert RGB (0-255) to HSL (h: 0-360, s: 0-1, l: 0-1)
fn rgb_to_hsl(r: u8, g: u8, b: u8) -> (f32, f32, f32) {
    let r = r as f32 / 255.0;
    let g = g as f32 / 255.0;
    let b = b as f32 / 255.0;

    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let l = (max + min) / 2.0;

    if (max - min).abs() < f32::EPSILON {
        return (0.0, 0.0, l);
    }

    let d = max - min;
    let s = if l > 0.5 {
        d / (2.0 - max - min)
    } else {
        d / (max + min)
    };

    let h = if (max - r).abs() < f32::EPSILON {
        let mut h = (g - b) / d;
        if g < b {
            h += 6.0;
        }
        h
    } else if (max - g).abs() < f32::EPSILON {
        (b - r) / d + 2.0
    } else {
        (r - g) / d + 4.0
    };

    (h * 60.0, s, l)
}

/// Convert HSL (h: 0-360, s: 0-1, l: 0-1) to RGB (0-255)
fn hsl_to_rgb(h: f32, s: f32, l: f32) -> (u8, u8, u8) {
    if s.abs() < f32::EPSILON {
        let v = (l * 255.0).round() as u8;
        return (v, v, v);
    }

    let q = if l < 0.5 {
        l * (1.0 + s)
    } else {
        l + s - l * s
    };
    let p = 2.0 * l - q;
    let h = h / 360.0;

    let hue_to_rgb = |p: f32, q: f32, mut t: f32| -> f32 {
        if t < 0.0 {
            t += 1.0;
        }
        if t > 1.0 {
            t -= 1.0;
        }
        if t < 1.0 / 6.0 {
            return p + (q - p) * 6.0 * t;
        }
        if t < 1.0 / 2.0 {
            return q;
        }
        if t < 2.0 / 3.0 {
            return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
        }
        p
    };

    let r = (hue_to_rgb(p, q, h + 1.0 / 3.0) * 255.0).round() as u8;
    let g = (hue_to_rgb(p, q, h) * 255.0).round() as u8;
    let b = (hue_to_rgb(p, q, h - 1.0 / 3.0) * 255.0).round() as u8;

    (r, g, b)
}

/// Calculate luminance from RGB values (0-1 range)
fn luminance(r: f32, g: f32, b: f32) -> f32 {
    0.299 * r + 0.587 * g + 0.114 * b
}

/// Apply saturation adjustment to an image
fn apply_saturation(img: &RgbaImage, factor: f32) -> RgbaImage {
    let (width, height) = img.dimensions();
    let mut output = RgbaImage::new(width, height);

    for (x, y, pixel) in img.enumerate_pixels() {
        let [r, g, b, a] = pixel.0;
        let (h, s, l) = rgb_to_hsl(r, g, b);
        let new_s = (s * factor).clamp(0.0, 1.0);
        let (new_r, new_g, new_b) = hsl_to_rgb(h, new_s, l);
        output.put_pixel(x, y, Rgba([new_r, new_g, new_b, a]));
    }

    output
}

/// Apply vibrance adjustment (affects less saturated colors more)
fn apply_vibrance(img: &RgbaImage, amount: f32) -> RgbaImage {
    let (width, height) = img.dimensions();
    let mut output = RgbaImage::new(width, height);

    for (x, y, pixel) in img.enumerate_pixels() {
        let [r, g, b, a] = pixel.0;
        let (h, s, l) = rgb_to_hsl(r, g, b);
        
        // Vibrance affects low-saturation colors more than high-saturation ones
        let adjustment = amount * (1.0 - s);
        let new_s = (s + adjustment).clamp(0.0, 1.0);
        
        let (new_r, new_g, new_b) = hsl_to_rgb(h, new_s, l);
        output.put_pixel(x, y, Rgba([new_r, new_g, new_b, a]));
    }

    output
}

/// Apply exposure adjustment (in stops, like a camera)
fn apply_exposure(img: &RgbaImage, stops: f32) -> RgbaImage {
    let (width, height) = img.dimensions();
    let mut output = RgbaImage::new(width, height);
    let multiplier = 2.0_f32.powf(stops);

    for (x, y, pixel) in img.enumerate_pixels() {
        let [r, g, b, a] = pixel.0;
        let new_r = ((r as f32 * multiplier).round() as u16).min(255) as u8;
        let new_g = ((g as f32 * multiplier).round() as u16).min(255) as u8;
        let new_b = ((b as f32 * multiplier).round() as u16).min(255) as u8;
        output.put_pixel(x, y, Rgba([new_r, new_g, new_b, a]));
    }

    output
}

/// Apply gamma correction
fn apply_gamma(img: &RgbaImage, gamma: f32) -> RgbaImage {
    let (width, height) = img.dimensions();
    let mut output = RgbaImage::new(width, height);
    let inv_gamma = 1.0 / gamma;

    for (x, y, pixel) in img.enumerate_pixels() {
        let [r, g, b, a] = pixel.0;
        let new_r = ((r as f32 / 255.0).powf(inv_gamma) * 255.0).round() as u8;
        let new_g = ((g as f32 / 255.0).powf(inv_gamma) * 255.0).round() as u8;
        let new_b = ((b as f32 / 255.0).powf(inv_gamma) * 255.0).round() as u8;
        output.put_pixel(x, y, Rgba([new_r, new_g, new_b, a]));
    }

    output
}

/// Apply shadows adjustment (affects dark areas)
fn apply_shadows(img: &RgbaImage, amount: f32) -> RgbaImage {
    let (width, height) = img.dimensions();
    let mut output = RgbaImage::new(width, height);

    for (x, y, pixel) in img.enumerate_pixels() {
        let [r, g, b, a] = pixel.0;
        let rf = r as f32 / 255.0;
        let gf = g as f32 / 255.0;
        let bf = b as f32 / 255.0;
        
        let lum = luminance(rf, gf, bf);
        
        // Apply adjustment only to dark areas (shadows), with smooth falloff
        let shadow_weight = (1.0 - lum * 2.0).max(0.0);
        let adjustment = 1.0 + (amount / 100.0) * shadow_weight;
        
        let new_r = ((rf * adjustment) * 255.0).round().clamp(0.0, 255.0) as u8;
        let new_g = ((gf * adjustment) * 255.0).round().clamp(0.0, 255.0) as u8;
        let new_b = ((bf * adjustment) * 255.0).round().clamp(0.0, 255.0) as u8;
        
        output.put_pixel(x, y, Rgba([new_r, new_g, new_b, a]));
    }

    output
}

/// Apply highlights adjustment (affects bright areas)
fn apply_highlights(img: &RgbaImage, amount: f32) -> RgbaImage {
    let (width, height) = img.dimensions();
    let mut output = RgbaImage::new(width, height);

    for (x, y, pixel) in img.enumerate_pixels() {
        let [r, g, b, a] = pixel.0;
        let rf = r as f32 / 255.0;
        let gf = g as f32 / 255.0;
        let bf = b as f32 / 255.0;
        
        let lum = luminance(rf, gf, bf);
        
        // Apply adjustment only to bright areas (highlights), with smooth falloff
        let highlight_weight = ((lum - 0.5) * 2.0).max(0.0);
        let adjustment = 1.0 + (amount / 100.0) * highlight_weight;
        
        let new_r = ((rf * adjustment) * 255.0).round().clamp(0.0, 255.0) as u8;
        let new_g = ((gf * adjustment) * 255.0).round().clamp(0.0, 255.0) as u8;
        let new_b = ((bf * adjustment) * 255.0).round().clamp(0.0, 255.0) as u8;
        
        output.put_pixel(x, y, Rgba([new_r, new_g, new_b, a]));
    }

    output
}

#[wasm_bindgen]
pub fn adjust_image(
    data: &[u8],
    brightness: i32,      // -100 to +100
    contrast_val: f32,    // -100 to +100
    saturation: f32,      // 0 to 2 (1 = original)
    hue: i32,             // -180 to +180 degrees
    exposure: f32,        // -2 to +2 stops
    gamma: f32,           // 0.1 to 3.0 (1 = original)
    shadows: f32,         // -100 to +100
    highlights: f32,      // -100 to +100
    vibrance: f32,        // -100 to +100 (maps to -1 to +1)
) -> Result<Vec<u8>, String> {
    let decoded = decode_image(data)?;
    let mut rgba = decoded.img.to_rgba8();

    // Apply adjustments in a logical order
    
    // 1. Exposure (multiplicative, apply early)
    if exposure.abs() > 0.001 {
        rgba = apply_exposure(&rgba, exposure);
    }

    // 2. Shadows and Highlights
    if shadows.abs() > 0.001 {
        rgba = apply_shadows(&rgba, shadows);
    }
    if highlights.abs() > 0.001 {
        rgba = apply_highlights(&rgba, highlights);
    }

    // 3. Gamma correction
    if (gamma - 1.0).abs() > 0.001 {
        rgba = apply_gamma(&rgba, gamma);
    }

    // 4. Brightness (using image crate's brighten, scale from -100..+100 to approx -128..+128)
    if brightness != 0 {
        let brightness_scaled = (brightness as f32 * 1.28).round() as i32;
        rgba = brighten(&rgba, brightness_scaled);
    }

    // 5. Contrast (using image crate's contrast)
    if contrast_val.abs() > 0.001 {
        rgba = contrast(&rgba, contrast_val);
    }

    // 6. Color adjustments: Saturation, Vibrance, Hue
    if (saturation - 1.0).abs() > 0.001 {
        rgba = apply_saturation(&rgba, saturation);
    }
    
    if vibrance.abs() > 0.001 {
        // Convert -100..+100 to -1..+1
        let vibrance_normalized = vibrance / 100.0;
        rgba = apply_vibrance(&rgba, vibrance_normalized);
    }

    if hue != 0 {
        rgba = huerotate(&rgba, hue);
    }

    // Convert back to DynamicImage and encode
    let adjusted = DynamicImage::ImageRgba8(rgba);
    
    let mut output = Vec::new();
    adjusted.write_to(&mut Cursor::new(&mut output), decoded.format)
        .map_err(|e| format!("Failed to encode adjusted image: {}", e))?;

    Ok(output)
}
