//! Create a file that only its owner can read, on every platform the app
//! writes plaintext secrets on.
//!
//! The restriction is part of the *creation*, never applied afterwards: a file
//! that exists for even a moment under the folder's own permissions can be
//! opened in that moment, and a handle opened then keeps its access whatever
//! the permissions become. Unix has a mode for this (`0600`). Windows has no
//! chmod analog; the equivalent is a *protected* DACL — one that does not
//! inherit from the folder — granting the current user and SYSTEM (which
//! backup, indexing and antivirus services run as) and nobody else, handed to
//! `CreateFile` in the security attributes so the file is born with it.

use std::fs::{File, OpenOptions};
use std::io;
use std::path::Path;

/// Create `path`, which must not exist yet, for writing — readable by its
/// owner alone from the first instant.
#[cfg(unix)]
pub fn create_new(path: &Path) -> io::Result<File> {
    use std::os::unix::fs::OpenOptionsExt;
    OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)
}

/// Create `path`, which must not exist yet, for writing — readable by its
/// owner alone from the first instant.
#[cfg(windows)]
pub fn create_new(path: &Path) -> io::Result<File> {
    use std::os::windows::fs::OpenOptionsExt;
    use windows::core::BOOL;
    use windows::Win32::Security::SECURITY_ATTRIBUTES;

    let descriptor = OwnerOnlyDescriptor::for_current_user()?;
    let mut attributes = SECURITY_ATTRIBUTES {
        nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: descriptor.as_ptr(),
        bInheritHandle: BOOL(0),
    };
    OpenOptions::new()
        .write(true)
        .create_new(true)
        .security_attributes((&mut attributes as *mut SECURITY_ATTRIBUTES).cast())
        .open(path)
}

// The SDDL for "this user and SYSTEM, full access, nothing inherited". `P`
// marks the DACL protected, which is what stops the folder's inheritable
// entries from being merged into the new file's DACL at creation.
#[cfg(windows)]
fn owner_only_sddl(user_sid: &str) -> String {
    format!("D:P(A;;FA;;;{user_sid})(A;;FA;;;SY)")
}

#[cfg(windows)]
fn win(e: windows::core::Error) -> io::Error {
    io::Error::other(e.to_string())
}

/// A self-relative security descriptor built from [`owner_only_sddl`], freed
/// with the `LocalFree` its builder requires.
#[cfg(windows)]
struct OwnerOnlyDescriptor(windows::Win32::Security::PSECURITY_DESCRIPTOR);

#[cfg(windows)]
impl OwnerOnlyDescriptor {
    fn for_current_user() -> io::Result<Self> {
        use windows::core::HSTRING;
        use windows::Win32::Security::Authorization::{
            ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
        };
        use windows::Win32::Security::PSECURITY_DESCRIPTOR;

        let sddl = HSTRING::from(owner_only_sddl(&current_user_sid()?));
        let mut descriptor = PSECURITY_DESCRIPTOR::default();
        unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                &sddl,
                SDDL_REVISION_1,
                &mut descriptor,
                None,
            )
        }
        .map_err(win)?;
        Ok(Self(descriptor))
    }

    fn as_ptr(&self) -> *mut core::ffi::c_void {
        self.0 .0
    }
}

#[cfg(windows)]
impl Drop for OwnerOnlyDescriptor {
    fn drop(&mut self) {
        use windows::Win32::Foundation::{LocalFree, HLOCAL};
        unsafe {
            LocalFree(Some(HLOCAL(self.0 .0)));
        }
    }
}

// The current user's SID, as the text SDDL wants.
#[cfg(windows)]
fn current_user_sid() -> io::Result<String> {
    use windows::core::PWSTR;
    use windows::Win32::Foundation::{CloseHandle, LocalFree, HANDLE, HLOCAL};
    use windows::Win32::Security::Authorization::ConvertSidToStringSidW;
    use windows::Win32::Security::{GetTokenInformation, TokenUser, TOKEN_QUERY, TOKEN_USER};
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    unsafe {
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
        sid
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::io::Write;
    use std::os::unix::fs::PermissionsExt;

    #[test]
    fn a_file_is_born_owner_readable_only() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("secret");

        let mut created = create_new(&file).unwrap();
        // Before a byte is written, the mode is already in force.
        assert_eq!(
            std::fs::metadata(&file).unwrap().permissions().mode() & 0o777,
            0o600
        );
        created.write_all(b"s").unwrap();
        drop(created);

        assert_eq!(std::fs::read(&file).unwrap(), b"s");
        // Never over an existing file: the caller picks a fresh sibling name.
        assert_eq!(
            create_new(&file).unwrap_err().kind(),
            std::io::ErrorKind::AlreadyExists
        );
    }
}
