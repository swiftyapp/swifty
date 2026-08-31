//! Biometric-unlock seam. In-session re-unlock only (parity with legacy Touch
//! ID): prompt the OS biometric dialog; the master key never leaves memory.

use crate::error::{Error, Result};

#[cfg(target_os = "macos")]
mod imp {
    use super::*;
    use block2::RcBlock;
    use objc2::runtime::Bool;
    use objc2_foundation::{NSError, NSString};
    use objc2_local_authentication::{LAContext, LAPolicy};
    use std::sync::mpsc;

    const POLICY: LAPolicy = LAPolicy::DeviceOwnerAuthenticationWithBiometrics;

    pub fn is_available() -> bool {
        unsafe { LAContext::new().canEvaluatePolicy_error(POLICY).is_ok() }
    }

    #[allow(dead_code)] // verify-then-read path; unused on macOS (OS-enforced-on-read)
    pub fn authenticate() -> Result<()> {
        let ctx = unsafe { LAContext::new() };
        let reason = NSString::from_str("Confirm your identity");
        // evaluatePolicy fires its reply on an internal queue; block on a channel.
        let (tx, rx) = mpsc::channel();
        let reply = RcBlock::new(move |success: Bool, _err: *mut NSError| {
            let _ = tx.send(success.as_bool());
        });
        unsafe { ctx.evaluatePolicy_localizedReason_reply(POLICY, &reason, &reply) };
        match rx.recv() {
            Ok(true) => Ok(()),
            _ => Err(Error::Other("biometric authentication failed".into())),
        }
    }
}

#[cfg(target_os = "windows")]
mod imp {
    use super::*;
    use windows::core::HSTRING;
    use windows::Security::Credentials::UI::{
        UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
    };

    pub fn is_available() -> bool {
        UserConsentVerifier::CheckAvailabilityAsync()
            .and_then(|op| op.get())
            .map(|a| a == UserConsentVerifierAvailability::Available)
            .unwrap_or(false)
    }

    pub fn authenticate() -> Result<()> {
        let message = HSTRING::from("Confirm your identity");
        let verified = UserConsentVerifier::RequestVerificationAsync(&message)
            .and_then(|op| op.get())
            .map(|r| r == UserConsentVerificationResult::Verified)
            .unwrap_or(false);
        if verified {
            Ok(())
        } else {
            Err(Error::Other("biometric authentication failed".into()))
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod imp {
    use super::*;

    pub fn is_available() -> bool {
        false
    }

    #[allow(dead_code)]
    pub fn authenticate() -> Result<()> {
        Err(Error::Other("biometrics not supported on this platform".into()))
    }
}

pub fn is_available() -> bool {
    imp::is_available()
}

// Used only where the biometric gate is verify-then-read (Windows). On macOS the
// OS enforces biometry on Keychain read, so no explicit prompt call is needed.
#[allow(dead_code)]
pub fn authenticate() -> Result<()> {
    imp::authenticate()
}
