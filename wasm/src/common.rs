use image::{DynamicImage, ImageFormat, ImageReader};
use std::io::Cursor;

pub(crate) struct DecodedImage {
    pub img: DynamicImage,
    pub format: ImageFormat,
    pub format_name: String,
}

pub(crate) fn decode_image(data: &[u8]) -> Result<DecodedImage, String> {
    let reader = ImageReader::new(Cursor::new(data))
        .with_guessed_format()
        .map_err(|e| format!("Failed to identify format: {}", e))?;

    let format = reader.format().unwrap_or(ImageFormat::Png);
    let format_name = format!("{:?}", format);

    let img = reader.decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    Ok(DecodedImage { img, format, format_name })
}
