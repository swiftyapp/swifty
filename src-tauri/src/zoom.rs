//! A macOS window zoom the web content can follow.
//!
//! Every way of zooming the main window — the header's double click (Tauri's
//! drag-region script → tao's `set_maximized`), the green traffic light,
//! option-click — ends in `[NSWindow zoom:]`, and its frame animation is a
//! *blocking* one: AppKit spins the main thread in a private run-loop mode
//! until the window is at its final size. The webview renders out of process
//! and hands each new frame to the main thread as a message that is only
//! delivered in the ordinary run-loop modes, so through the whole animation
//! the last render sits clipped in the window's corner, and the page snaps
//! into place when `zoom:` returns.
//!
//! `windowShouldZoom:toFrame:` is AppKit's hook for vetoing that animation:
//! `zoom:` computes the frame it wants, asks the delegate, and does nothing
//! more on a `NO`. So the delegate says no and moves the window itself through
//! its animator, which is a non-blocking animation on the ordinary run loop —
//! the web process's frames land between its steps and the page follows the
//! way it does under a drag resize. The duration is AppKit's own
//! `animationResizeTime:`, so the zoom looks and paces exactly as before.
//!
//! tao owns the window delegate (`TaoWindowDelegate`, tao 0.35.3), which does
//! not implement the method, so it is added to that class at runtime. Should a
//! tao upgrade add its own, `class_addMethod` fails and the zoom simply stays
//! native; the warning below is what says so.

use std::ffi::c_void;
use std::sync::Mutex;

use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject, Bool, Imp, Sel};
use objc2::{ffi, msg_send, sel};
use objc2_app_kit::{NSAnimationContext, NSWindow};
use objc2_foundation::NSRect;

// Where the window goes back to on un-zoom. AppKit keeps its own note of this,
// but it takes it while performing the zoom that is being vetoed here, so it
// is kept independently. One main window per process.
static RESTORE: Mutex<Option<NSRect>> = Mutex::new(None);

/// Route the zoom of `ns_window` (a `*mut NSWindow`, as `WebviewWindow::ns_window`
/// hands it out) through the animator. Main thread only.
pub fn install(ns_window: *mut c_void) {
    let window: &NSWindow = unsafe { &*ns_window.cast::<NSWindow>() };
    let Some(delegate) = window.delegate() else {
        log::warn!("main window has no delegate; zoom stays native");
        return;
    };
    let class: *const AnyClass = unsafe { msg_send![&*delegate, class] };

    // BOOL (self, _cmd, NSWindow *, NSRect)
    let types = c"B@:@{CGRect={CGPoint=dd}{CGSize=dd}}";
    let added = unsafe {
        ffi::class_addMethod(
            class.cast_mut(),
            sel!(windowShouldZoom:toFrame:),
            std::mem::transmute::<ShouldZoom, Imp>(should_zoom),
            types.as_ptr(),
        )
    };
    if !added.as_bool() {
        log::warn!("window delegate already handles windowShouldZoom:toFrame:; zoom stays native");
    }
}

type ShouldZoom = extern "C-unwind" fn(&AnyObject, Sel, &NSWindow, NSRect) -> Bool;

extern "C-unwind" fn should_zoom(
    _this: &AnyObject,
    _cmd: Sel,
    window: &NSWindow,
    proposed: NSRect,
) -> Bool {
    let mut restore = RESTORE.lock().unwrap_or_else(|e| e.into_inner());
    let target = if window.isZoomed() {
        // A window that was already zoomed when it first appeared has nowhere
        // of its own to go back to; AppKit's proposal is the best there is.
        restore.take().unwrap_or(proposed)
    } else {
        *restore = Some(window.frame());
        proposed
    };
    drop(restore);

    unsafe {
        NSAnimationContext::beginGrouping();
        NSAnimationContext::currentContext().setDuration(window.animationResizeTime(target));
        let animator: Retained<NSWindow> = msg_send![window, animator];
        animator.setFrame_display(target, true);
        NSAnimationContext::endGrouping();
    }
    Bool::NO
}
