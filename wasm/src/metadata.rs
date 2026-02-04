use wasm_bindgen::prelude::*;
use std::io::Cursor;
use exif::{In, Tag};

use crate::common::decode_image;

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
