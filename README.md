![swifty_banner_alpha](https://user-images.githubusercontent.com/695947/211563458-93194014-d14b-4f1a-be03-ce368b4456e3.png)

## Free Offline-first Password Manager for MacOS, Windows and Linux.

<div align="center">
  
  [![](https://img.shields.io/badge/PayPal-Buy%20me%20a%20Coffee-blue)](https://www.paypal.me/alchaplinsky)
  
  [![Actions Status](https://github.com/swiftyapp/swifty/workflows/CI/badge.svg)](https://github.com/swiftyapp/swifty/actions)
  [![Financial Contributors on Open Collective](https://opencollective.com/swifty/all/badge.svg?label=financial+contributors)](https://opencollective.com/swifty) ![GitHub release (latest SemVer including pre-releases)](https://img.shields.io/github/v/release/swiftyapp/swifty?include_prereleases&label=Release)
  ![GitHub All Releases](https://img.shields.io/github/downloads/swiftyapp/swifty/total?label=Downloads)
  [![Encryption](https://img.shields.io/badge/Encryption-AES%20256%20GCM-green.svg)](https://tools.ietf.org/html/rfc5288)
  
</div>

❤️ it? Then ⭐️ it on GitHub or Tweet about it.

## Features

- Store Login/Password credentials
- Credit card Information 
- Secure notes to store sensitive information
- One-click Strong Password Generation
- Time-based One Time Passwords support (TOTP)
- Google Drive Sync (optional)
- No data is leaving your computer:
  - Everything is encrypted, stored and decrypted on your local file system
  - Decryption happens once on entering Master Password
  - Ability to migrate from one computer to another using backup file or GDrive sync
- There's more to come...

## Screenshots

<img width="1012" alt="swifty_screen_01" src="https://user-images.githubusercontent.com/695947/211563356-eb75a92d-2582-4034-9e53-a596159f4892.png">
<img width="1012" alt="swifty_screen_02" src="https://user-images.githubusercontent.com/695947/211563370-6d965b21-5be8-410a-97b0-d528af4c0efc.png">


## Install

Check the [Latest Releases](https://github.com/swiftyapp/swifty/releases) page for the
most recent packaged app for MacOS, Windows or Linux.

## Development

Swifty is built with [Tauri 2](https://v2.tauri.app) (Rust backend + TypeScript/React/Vite frontend).

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- [Rust](https://rustup.rs) (stable toolchain)
- Platform build dependencies for Tauri — see the
  [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/)
  (on Linux: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libgtk-3-dev`)

### Commands

```bash
git clone git@github.com:swiftyapp/swifty.git
cd swifty
npm install

npm run tauri:dev     # run the app in development
npm run tauri:build   # produce a signed, packaged build for the current OS

npm run build         # build the frontend only (tsc + vite)
npm test              # frontend unit tests (Vitest)
cd src-tauri && cargo test   # backend tests
```

## Configuration

### Google Drive sync (optional)

Drive sync uses **your own** Google OAuth **Desktop** client — no credentials
are bundled with the app. To enable it:

1. In the [Google Cloud Console](https://console.cloud.google.com) create an
   OAuth 2.0 Client ID of type **Desktop app**.
2. Enable the **Google Drive API** for the project.
3. The app requests the `https://www.googleapis.com/auth/drive.file` scope and
   listens on the loopback redirect URI `http://127.0.0.1:4567/auth/callback`.
4. Provide the credentials as environment/build variables when running or
   building:

   ```bash
   export GOOGLE_OAUTH_CLIENT_ID=your-desktop-client-id.apps.googleusercontent.com
   export GOOGLE_OAUTH_CLIENT_SECRET=your-desktop-client-secret   # optional
   ```

   They are read at runtime (`std::env::var`) and, if absent, fall back to the
   value baked in at compile time (`option_env!`). The build succeeds without
   them — sync simply reports "Google OAuth client not configured" until a
   client id is supplied.

### Auto-update signing

Release builds are signed for `tauri-plugin-updater`. The public key lives in
`src-tauri/tauri.conf.json`; the matching **private key is never committed** and
is provided to CI via the `TAURI_SIGNING_PRIVATE_KEY` (and
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) secrets. Generate a keypair with
`npm run tauri signer generate -- -w ~/.swifty/updater.key`.

## Contributors

### Code Contributors

This project exists thanks to all the people who contribute. [[Contribute](CONTRIBUTING.md)].
<a href="https://github.com/swiftyapp/swifty/graphs/contributors"><img src="https://opencollective.com/swifty/contributors.svg?width=890&button=false" /></a>

### Financial Contributors

Become a financial contributor and help us sustain our community. [[Contribute](https://opencollective.com/swifty/contribute)]

#### Individuals

<a href="https://opencollective.com/swifty"><img src="https://opencollective.com/swifty/individuals.svg?width=890"></a>

#### Organizations

Support this project with your organization. Your logo will show up here with a link to your website. [[Contribute](https://opencollective.com/swifty/contribute)]

<a href="https://opencollective.com/swifty/organization/0/website"><img src="https://opencollective.com/swifty/organization/0/avatar.svg"></a>
<a href="https://opencollective.com/swifty/organization/1/website"><img src="https://opencollective.com/swifty/organization/1/avatar.svg"></a>
<a href="https://opencollective.com/swifty/organization/2/website"><img src="https://opencollective.com/swifty/organization/2/avatar.svg"></a>
<a href="https://opencollective.com/swifty/organization/3/website"><img src="https://opencollective.com/swifty/organization/3/avatar.svg"></a>
<a href="https://opencollective.com/swifty/organization/4/website"><img src="https://opencollective.com/swifty/organization/4/avatar.svg"></a>
<a href="https://opencollective.com/swifty/organization/5/website"><img src="https://opencollective.com/swifty/organization/5/avatar.svg"></a>
<a href="https://opencollective.com/swifty/organization/6/website"><img src="https://opencollective.com/swifty/organization/6/avatar.svg"></a>
<a href="https://opencollective.com/swifty/organization/7/website"><img src="https://opencollective.com/swifty/organization/7/avatar.svg"></a>
<a href="https://opencollective.com/swifty/organization/8/website"><img src="https://opencollective.com/swifty/organization/8/avatar.svg"></a>
<a href="https://opencollective.com/swifty/organization/9/website"><img src="https://opencollective.com/swifty/organization/9/avatar.svg"></a>

## License

GNU/GPL Version 3
