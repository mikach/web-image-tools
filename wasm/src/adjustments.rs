use wasm_bindgen::prelude::*;
use image::{DynamicImage, Rgba, RgbaImage};
use image::imageops::{brighten, contrast, huerotate};
use std::io::Cursor;

use crate::common::decode_image;

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
