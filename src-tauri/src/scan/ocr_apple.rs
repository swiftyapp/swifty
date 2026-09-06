//! Text recognition through Apple's Vision framework.
//!
//! Vision opens and decodes the file itself, so there is no image crate here
//! and no copy of the picture in this process' memory.

use objc2::AllocAnyThread;
use objc2_foundation::{NSArray, NSDictionary, NSString, NSURL};
use objc2_vision::{
    VNImageRequestHandler, VNRecognizeTextRequest, VNRequest, VNRequestTextRecognitionLevel,
};
use std::path::Path;

use super::Ocr;
use crate::error::{Error, Result};

pub struct VisionOcr;

impl Ocr for VisionOcr {
    fn recognize(&self, image_path: &Path) -> Result<Vec<String>> {
        let path = image_path
            .to_str()
            .ok_or_else(|| Error::Other("image path is not valid UTF-8".into()))?;
        let url = NSURL::fileURLWithPath(&NSString::from_str(path));

        let request = VNRecognizeTextRequest::new();
        // A card number and an MRZ are not words: language correction "corrects"
        // them into ones. The accurate level is also the only one that reads
        // small embossed print reliably — this runs off the UI thread anyway.
        request.setRecognitionLevel(VNRequestTextRecognitionLevel::Accurate);
        request.setUsesLanguageCorrection(false);

        let handler = unsafe {
            VNImageRequestHandler::initWithURL_options(
                VNImageRequestHandler::alloc(),
                &url,
                &NSDictionary::new(),
            )
        };
        let as_request: &VNRequest = &request;
        handler
            .performRequests_error(&NSArray::from_slice(&[as_request]))
            .map_err(|e| Error::Other(format!("could not read the image: {e}")))?;

        let Some(observations) = request.results() else {
            return Ok(Vec::new());
        };
        // Vision measures from the bottom-left corner, so the parsers' reading
        // order is the top edge of each observation, descending.
        let mut lines: Vec<(f64, String)> = Vec::new();
        for observation in observations.iter() {
            let Some(best) = observation.topCandidates(1).firstObject() else {
                continue;
            };
            let text = best.string().to_string();
            if text.trim().is_empty() {
                continue;
            }
            let frame = unsafe { observation.boundingBox() };
            lines.push((frame.origin.y + frame.size.height, text));
        }
        lines.sort_by(|a, b| b.0.total_cmp(&a.0));
        Ok(lines.into_iter().map(|(_, text)| text).collect())
    }
}
