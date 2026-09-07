// Regenerates every app icon from the SVG sources in src-tauri/icons.
//
// Desktop (macOS/Windows/Linux) and the tray use the padded artwork as-is.
// iOS masks icons into its own squircle, so it needs a full-bleed variant:
// `tauri icon` has no iOS-only mode and always regenerates the whole set, so
// the iOS variant is rendered into a temp dir and only its ios/ output is
// copied over — into src-tauri/icons/ios and the Xcode asset catalog.
import { execSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ICONS = "src-tauri/icons";
const XCASSETS = "src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

run(`tauri icon ${ICONS}/asterisq.svg -o ${ICONS}`);
run(`tauri icon ${ICONS}/tray.svg -o ${ICONS}/tray -p 72`);

const tmp = mkdtempSync(join(tmpdir(), "swifty-ios-icons-"));
try {
  run(`tauri icon ${ICONS}/asterisq-ios.svg -o ${tmp}`);
  cpSync(join(tmp, "ios"), `${ICONS}/ios`, { recursive: true });
  cpSync(join(tmp, "ios"), XCASSETS, { recursive: true });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
