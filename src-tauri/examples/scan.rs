//! Thin CLI over the image scanner, for checking the platform OCR backend
//! against a real picture: `cargo run --example scan -- /path/to/photo.png`.
//! Prints the recognized lines, then whatever the parsers made of them. Not
//! shipped in the app.

use std::path::Path;

use swifty_lib::scan::{platform_ocr, scan_lines};

fn main() {
    let Some(path) = std::env::args().nth(1) else {
        eprintln!("usage: scan <image path>");
        std::process::exit(1);
    };
    let Some(ocr) = platform_ocr() else {
        eprintln!("no text recognizer on this platform");
        std::process::exit(1);
    };

    let lines = ocr.recognize(Path::new(&path)).unwrap_or_else(|e| {
        eprintln!("{e}");
        std::process::exit(1);
    });
    println!("--- {} lines recognized", lines.len());
    for line in &lines {
        println!("{line}");
    }

    match scan_lines(&lines) {
        Some(found) => {
            println!("--- {}", found.kind);
            for (key, value) in &found.fields {
                println!("{key}: {value}");
            }
        }
        None => println!("--- nothing recognized"),
    }
}
