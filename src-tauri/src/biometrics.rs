//! Biometric-unlock seam. In-session re-unlock only (parity with legacy Touch
//! ID): prompt the OS biometric dialog; the master key never leaves memory.

use crate::error::{Error, Result};

// LocalAuthentication is the same framework on both Apple platforms: Touch ID /
// Face ID come out of the same `LAContext` policy evaluation.
#[cfg(target_vendor = "apple")]
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

#[cfg(not(any(target_vendor = "apple", target_os = "windows")))]
mod imp {
    use super::*;

    pub fn is_available() -> bool {
        false
    }

    #[allow(dead_code)]
    pub fn authenticate() -> Result<()> {
        Err(Error::Other(
            "biometrics not supported on this platform".into(),
        ))
    }
}

pub fn is_available() -> bool {
    imp::is_available()
}

// The verify-then-read gate: Windows always, and macOS/iOS in `GateMode::Prompt`
// (unentitled builds, where the OS cannot enforce biometry on keychain read).
// Nothing calls it on Linux, where the secure store is unsupported outright.
#[cfg_attr(
    not(any(target_vendor = "apple", target_os = "windows")),
    allow(dead_code)
)]
pub fn authenticate() -> Result<()> {
    imp::authenticate()
}
