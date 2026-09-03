//! Text recognition through `Windows.Media.Ocr`.
//!
//! This project builds on macOS and Linux, so nothing here is ever compiled by
//! its CI. It is therefore kept as small as the API allows and does no work of
//! its own: open the file, decode it, recognize, hand back the lines the engine
//! already grouped and ordered.

use std::path::Path;

use windows::core::HSTRING;
use windows::Graphics::Imaging::BitmapDecoder;
use windows::Media::Ocr::OcrEngine;
use windows::Storage::{FileAccessMode, StorageFile};

use super::Ocr;
use crate::error::{Error, Result};

pub struct WindowsOcr {
    engine: OcrEngine,
}

impl WindowsOcr {
    /// The recognizer for the languages the user's profile lists, when there is
    /// one. With no OCR language pack installed the API reports success with a
    /// null engine, which the bindings turn into an error carrying an `S_OK`
    /// code — either way there is nothing to recognize with.
    pub fn new() -> Option<Self> {
        OcrEngine::TryCreateFromUserProfileLanguages()
            .ok()
            .map(|engine| Self { engine })
    }
}

impl Ocr for WindowsOcr {
    fn recognize(&self, image_path: &Path) -> Result<Vec<String>> {
        // WinRT resolves this path itself and accepts only an absolute one.
        let path = image_path
            .to_str()
            .ok_or_else(|| Error::Other("image path is not valid UTF-8".into()))?;

        // Each `get()` blocks on the WinRT async operation; the whole call
        // already runs off the UI thread.
        let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(path))
            .and_then(|op| op.get())
            .map_err(failed)?;
        let stream = file
            .OpenAsync(FileAccessMode::Read)
            .and_then(|op| op.get())
            .map_err(failed)?;
        let decoder = BitmapDecoder::CreateAsync(&stream)
            .and_then(|op| op.get())
            .map_err(failed)?;
        let bitmap = decoder
            .GetSoftwareBitmapAsync()
            .and_then(|op| op.get())
            .map_err(failed)?;
        let recognized = self
            .engine
            .RecognizeAsync(&bitmap)
            .and_then(|op| op.get())
            .map_err(failed)?;

        let mut lines = Vec::new();
        for line in recognized.Lines().map_err(failed)? {
            let text = line.Text().map_err(failed)?.to_string();
            if !text.trim().is_empty() {
                lines.push(text);
            }
        }
        Ok(lines)
    }
}

fn failed(e: windows::core::Error) -> Error {
    Error::Other(format!("could not read the image: {e}"))
}
