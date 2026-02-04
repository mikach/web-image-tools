use wasm_bindgen::prelude::*;

mod common;
mod metadata;
mod transforms;
mod adjustments;

pub use metadata::ImageMetadata;
pub use metadata::read_image_metadata;
pub use transforms::{crop_image, resize_image, rotate_image};
pub use adjustments::adjust_image;

#[wasm_bindgen]
pub fn init_logging() {
    console_error_panic_hook::set_once();
}
