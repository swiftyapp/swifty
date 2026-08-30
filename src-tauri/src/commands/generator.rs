use crate::error::Result;
use crate::models::{GeneratorOptions, OtpResult};

#[tauri::command]
#[allow(unused_variables)]
pub fn generate_password(options: GeneratorOptions) -> Result<String> {
    todo!("PR-6: generate a password from options")
}

// Generate the current TOTP code for a base32 secret plus seconds left in the window.
#[tauri::command]
#[allow(unused_variables)]
pub fn generate_otp(secret: String) -> Result<OtpResult> {
    todo!("PR-6: compute TOTP code and remaining time")
}

#[tauri::command]
#[allow(unused_variables)]
pub fn verify_otp(secret: String, token: String) -> Result<bool> {
    todo!("PR-6: verify a TOTP token against the secret")
}
