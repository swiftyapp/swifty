# Security Policy

Swifty is an offline-first password manager. Your vault lives on your own device
as an encrypted SQLite database (SQLCipher), with each entry's secrets sealed in
an additional application-level AEAD layer, and the app has no backend that holds
your secrets. We take reports about the encryption, key derivation and handling,
update channel, and platform integration seriously.

## Supported Versions

Security fixes land in the latest released version. Older versions are not
patched; please update before reporting.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please report privately. Do not open a public issue, PR, or discussion for a
security problem.**

Preferred channel — GitHub private security advisories:

1. Go to <https://github.com/swiftyapp/swifty/security/advisories/new>.
2. Describe the issue, the affected version and platform (macOS / Windows /
   Linux), and steps to reproduce. A proof of concept helps.
3. We triage from there and, if needed, invite you into the advisory thread.

If you cannot use GitHub advisories, email the maintainers at
`security@getswifty.pro`.

What to include:

- The affected version (see the About screen) and OS.
- A clear description of the impact and how to reproduce it.
- Any relevant logs, but redact your own vault contents and secrets.

## Response and Disclosure

- **Acknowledgement:** within 72 hours of a report.
- **Triage and initial assessment:** within 7 days, including a severity call and
  a rough remediation timeline.
- **Fix and release:** as fast as the severity warrants; critical issues are
  prioritized over other work.
- **Coordinated disclosure:** we ask that you give us a reasonable window
  (up to 90 days) to ship a fix before any public write-up. We are happy to
  coordinate timing and to credit you in the advisory unless you prefer to stay
  anonymous.

## Scope

In scope: the desktop app and its Rust core — the SQLCipher at-rest encryption
and the per-entry application AEAD layer, key derivation and lifecycle, the
`.swftx` import path, the OS keychain / biometric integration, the Tauri command
surface and capabilities, the webview CSP, and the signed updater.

Out of scope: issues that require an already-compromised operating system,
physical access to an unlocked device, malware running with the user's
privileges, or social-engineering of the device owner. These are covered in
[`docs/threat-model.md`](docs/threat-model.md), which describes what Swifty does
and does not defend against.
