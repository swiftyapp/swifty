//! Make a file readable by its owner alone, on every platform the app writes
//! plaintext secrets on.
//!
//! Unix has a mode for it (`0600`). Windows has no chmod analog; the
//! equivalent is a *protected* DACL — one that stops inheriting from the
//! folder — granting access to the current user and to SYSTEM (which backup,
//! indexing and antivirus services run as) and to nobody else. Either way it
//! is applied to a freshly created, still-empty file, before any secret is
//! written into it, so the bytes are never readable through the folder's own
//! permissions even for a moment.

use std::io;
use std::path::Path;

#[cfg(unix)]
pub fn restrict_to_owner(path: &Path) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
}

// The SDDL for "this user and SYSTEM, full access, nothing inherited". `P`
// marks the DACL protected, and `SetNamedSecurityInfoW` is told the same with
// `PROTECTED_DACL_SECURITY_INFORMATION`, so the folder's inheritable entries
// are dropped rather than merged back in.
#[cfg(windows)]
fn owner_only_sddl(user_sid: &str) -> String {
    format!("D:P(A;;FA;;;{user_sid})(A;;FA;;;SY)")
}

#[cfg(windows)]
pub fn restrict_to_owner(path: &Path) -> io::Result<()> {
    use windows::core::{BOOL, HSTRING, PWSTR};
    use windows::Win32::Foundation::{CloseHandle, LocalFree, ERROR_SUCCESS, HANDLE, HLOCAL};
    use windows::Win32::Security::Authorization::{
        ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW,
        SetNamedSecurityInfoW, SDDL_REVISION_1, SE_FILE_OBJECT,
    };
    use windows::Win32::Security::{
        GetSecurityDescriptorDacl, GetTokenInformation, TokenUser, ACL, DACL_SECURITY_INFORMATION,
        PROTECTED_DACL_SECURITY_INFORMATION, PSECURITY_DESCRIPTOR, TOKEN_QUERY, TOKEN_USER,
    };
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    fn win(e: windows::core::Error) -> io::Error {
        io::Error::other(e.to_string())
    }

    // The current user's SID, as the text SDDL wants.
    let user_sid = unsafe {
        let mut token = HANDLE::default();
        OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).map_err(win)?;
        // Sized probe first: it fails with ERROR_INSUFFICIENT_BUFFER and reports
        // the length the real call needs.
        let mut len = 0u32;
        let _ = GetTokenInformation(token, TokenUser, None, 0, &mut len);
        // `u64` cells, not bytes: TOKEN_USER holds a pointer and has to be read
        // through a pointer-aligned allocation.
        let mut buf = vec![0u64; (len as usize).div_ceil(8)];
        let read = GetTokenInformation(
            token,
            TokenUser,
            Some(buf.as_mut_ptr().cast()),
            len,
            &mut len,
        );
        let _ = CloseHandle(token);
        read.map_err(win)?;
        let user = buf.as_ptr().cast::<TOKEN_USER>();

        let mut text = PWSTR::null();
        ConvertSidToStringSidW((*user).User.Sid, &mut text).map_err(win)?;
        let sid = text
            .to_string()
            .map_err(|e| io::Error::other(e.to_string()));
        LocalFree(Some(HLOCAL(text.0.cast())));
        sid?
    };

    let sddl = HSTRING::from(owner_only_sddl(&user_sid));
    let name = HSTRING::from(path.as_os_str());
    unsafe {
        let mut descriptor = PSECURITY_DESCRIPTOR::default();
        ConvertStringSecurityDescriptorToSecurityDescriptorW(
            &sddl,
            SDDL_REVISION_1,
            &mut descriptor,
            None,
        )
        .map_err(win)?;
        let mut present = BOOL(0);
        let mut defaulted = BOOL(0);
        let mut dacl: *mut ACL = std::ptr::null_mut();
        let applied =
            match GetSecurityDescriptorDacl(descriptor, &mut present, &mut dacl, &mut defaulted) {
                Ok(()) if present.as_bool() && !dacl.is_null() => {
                    let status = SetNamedSecurityInfoW(
                        &name,
                        SE_FILE_OBJECT,
                        DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
                        None,
                        None,
                        Some(dacl.cast_const()),
                        None,
                    );
                    if status == ERROR_SUCCESS {
                        Ok(())
                    } else {
                        Err(io::Error::from_raw_os_error(status.0 as i32))
                    }
                }
                Ok(()) => Err(io::Error::other(
                    "the owner-only security descriptor carries no DACL",
                )),
                Err(e) => Err(win(e)),
            };
        LocalFree(Some(HLOCAL(descriptor.0)));
        applied
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;

    #[test]
    fn a_restricted_file_is_owner_readable_only_whatever_it_was_before() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("secret");
        std::fs::write(&file, "s").unwrap();
        std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o644)).unwrap();

        restrict_to_owner(&file).unwrap();

        assert_eq!(
            std::fs::metadata(&file).unwrap().permissions().mode() & 0o777,
            0o600
        );
    }
}
