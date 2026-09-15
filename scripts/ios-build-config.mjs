// Prints the `--config` patch for `tauri ios build`, built from the environment.
//
// Environment variables do not reach the iOS Rust build. `tauri ios build`
// hands the compile to xcodebuild with a *replaced* environment — HOME, PATH
// and whatever the Tauri CLI forwards explicitly, which is only names starting
// with TAURI, WRY, CARGO_ or RUST_ (tauri-cli, mobile/mod.rs `env_vars`;
// cargo-mobile2, apple/target.rs `full_env`). So `option_env!("GOOGLE_API_KEY")`
// compiles to None on iOS no matter what the shell exported, and the desktop
// recipe of "export it before building" silently ships a build without it.
//
// What *does* get through is the config patch: the CLI stores it in
// TAURI_CONFIG, sets TAURI_<PLUGIN>_PLUGIN_CONFIG for every `plugins` entry
// (helpers/config.rs), and both are forwarded. tauri-codegen merges the patch
// into the config the binary embeds, so `app.config()` sees it at runtime, and
// tauri-plugin-deep-link's build script writes the schemes into Info.plist.
// Everything the iOS build needs from the environment therefore travels here:
//
//   BUILD_NUMBER                → bundle.iOS.bundleVersion   (CFBundleVersion)
//   GOOGLE_OAUTH_IOS_CLIENT_ID  → plugins.deep-link.mobile   (the reversed id,
//                                 which is both the URL scheme the redirect
//                                 comes back on and where the app reads the
//                                 client id from — src-tauri/src/sync/auth.rs)
//   GOOGLE_API_KEY              → plugins.swifty.googleApiKey
//                                 (src-tauri/src/build_settings.rs)
//
// Both `scripts/release-ios.sh` and `.github/workflows/release-ios.yml` run
// this and pass the output to `--config`. The two Google values are optional:
// missing, the build ships without Drive sync / share receiving and says so.
//
// Usage: bun scripts/ios-build-config.mjs

// RFC 1738 as Apple enforces it: leading letter, then letters, digits, '.',
// '+', '-'. A malformed scheme is rejected by App Store Connect with 90158 at
// the very end of the upload, so it is checked before the build instead.
export const LEGAL_SCHEME = /^[A-Za-z][A-Za-z0-9.+-]*$/

const IOS_CLIENT_ID_SUFFIX = '.apps.googleusercontent.com'
const IOS_SCHEME_PREFIX = 'com.googleusercontent.apps.'

/**
 * A Google iOS client's URL scheme is its client id reversed:
 * `123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc`.
 * Google shows it as "iOS URL scheme" on the credential page. Null for anything
 * that is not an iOS client id.
 */
export const schemeFromClientId = (clientId) => {
  if (!clientId.endsWith(IOS_CLIENT_ID_SUFFIX)) return null
  const id = clientId.slice(0, -IOS_CLIENT_ID_SUFFIX.length)
  return id === '' ? null : `${IOS_SCHEME_PREFIX}${id}`
}

/** The config patch for the given environment, plus what to warn about. */
export const buildConfig = (env) => {
  const warnings = []
  const buildNumber = env.BUILD_NUMBER ?? ''
  if (!/^\d+$/.test(buildNumber)) {
    throw new Error(`BUILD_NUMBER must be a positive integer, got "${buildNumber}"`)
  }
  const config = { bundle: { iOS: { bundleVersion: buildNumber } } }

  const clientId = env.GOOGLE_OAUTH_IOS_CLIENT_ID ?? ''
  if (clientId === '') {
    warnings.push('GOOGLE_OAUTH_IOS_CLIENT_ID is not set — building without Drive sync.')
  } else {
    const scheme = schemeFromClientId(clientId)
    if (scheme === null) {
      throw new Error(
        `GOOGLE_OAUTH_IOS_CLIENT_ID does not look like an iOS OAuth client id ` +
          `(expected <id>${IOS_CLIENT_ID_SUFFIX}). Is it the desktop client?`,
      )
    }
    if (!LEGAL_SCHEME.test(scheme)) {
      throw new Error(`the scheme derived from GOOGLE_OAUTH_IOS_CLIENT_ID is not a legal URL scheme: ${scheme}`)
    }
    config.plugins = { 'deep-link': { mobile: [{ scheme: [scheme] }] } }
  }

  const apiKey = env.GOOGLE_API_KEY ?? ''
  if (apiKey === '') {
    warnings.push('GOOGLE_API_KEY is not set — building without share receiving.')
  } else {
    config.plugins = { ...config.plugins, swifty: { googleApiKey: apiKey } }
  }

  return { config, warnings }
}

if (import.meta.main) {
  try {
    const { config, warnings } = buildConfig(process.env)
    for (const w of warnings) console.error(`warning: ${w}`)
    process.stdout.write(JSON.stringify(config))
  } catch (e) {
    console.error(`ios-build-config: ${e.message}`)
    process.exit(1)
  }
}
