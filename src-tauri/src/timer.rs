//! A re-armable one-shot timer served by a single parked thread.

use std::sync::{Arc, Condvar, Mutex, MutexGuard};
use std::time::{Duration, Instant};

struct Armed {
    at: Instant,
    fire: Box<dyn FnOnce() + Send>,
}

/// A timer that holds at most one pending callback, no matter how often it is
/// re-armed.
///
/// The alternative — spawn a thread that sleeps for the delay and then checks
/// whether it is still current — parks one OS thread per arming for the whole
/// delay, each keeping its captured state alive. With auto-lock timeouts up to
/// an hour that is one thread per alt-tab. Here a single thread waits on a
/// condvar for its whole life: [`Timer::arm`] re-points the deadline and wakes
/// it, [`Timer::disarm`] clears it.
pub struct Timer {
    armed: Mutex<Option<Armed>>,
    wake: Condvar,
}

impl Timer {
    /// Build a timer and start its one worker thread.
    pub fn spawn() -> Arc<Self> {
        let timer = Arc::new(Self {
            armed: Mutex::new(None),
            wake: Condvar::new(),
        });
        let worker = Arc::clone(&timer);
        std::thread::spawn(move || worker.run());
        timer
    }

    /// Run `fire` once, `after` from now, replacing whatever was pending.
    pub fn arm(&self, after: Duration, fire: impl FnOnce() + Send + 'static) {
        let now = Instant::now();
        // `Instant + Duration` panics on overflow, and the delays reaching here
        // come from settings on disk. A deadline no process outlives is the
        // honest reading of "later than the clock can express", and it cannot
        // take the whole app down with it.
        let at = now
            .checked_add(after)
            .unwrap_or_else(|| now + Duration::from_secs(u32::MAX as u64));
        *self.lock() = Some(Armed {
            at,
            fire: Box::new(fire),
        });
        self.wake.notify_all();
    }

    /// Drop the pending callback without running it; a no-op when idle.
    pub fn disarm(&self) {
        *self.lock() = None;
        self.wake.notify_all();
    }

    fn run(&self) {
        let mut armed = self.lock();
        loop {
            let now = Instant::now();
            let deadline = armed.as_ref().map(|a| a.at);
            armed = match deadline {
                None => self.wait(armed),
                Some(at) if at > now => self.wait_until(armed, at - now),
                // Due. Take the callback out of the slot before running it, so
                // it can only fire once and can safely re-arm the timer itself.
                Some(_) => {
                    let fire = armed.take().map(|a| a.fire);
                    drop(armed);
                    if let Some(fire) = fire {
                        // One worker thread serves every arming for the life of
                        // the process, so a callback that panics would take
                        // auto-lock and clipboard clearing down with it — and
                        // silently, since `arm` only fills a slot nobody reads
                        // any more. Catching here keeps the loop alive.
                        if std::panic::catch_unwind(std::panic::AssertUnwindSafe(fire)).is_err() {
                            log::warn!("timer callback panicked; the timer keeps running");
                        }
                    }
                    self.lock()
                }
            };
        }
    }

    fn lock(&self) -> MutexGuard<'_, Option<Armed>> {
        self.armed.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn wait<'a>(&self, guard: MutexGuard<'a, Option<Armed>>) -> MutexGuard<'a, Option<Armed>> {
        self.wake.wait(guard).unwrap_or_else(|e| e.into_inner())
    }

    fn wait_until<'a>(
        &self,
        guard: MutexGuard<'a, Option<Armed>>,
        left: Duration,
    ) -> MutexGuard<'a, Option<Armed>> {
        self.wake
            .wait_timeout(guard, left)
            .unwrap_or_else(|e| e.into_inner())
            .0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;

    const NEVER: Duration = Duration::from_secs(3600);

    #[test]
    fn re_arming_never_starts_a_second_thread() {
        let timer = Timer::spawn();
        for _ in 0..50 {
            timer.arm(NEVER, || {});
        }

        // The worker thread holds the only other handle on the timer, so a
        // second one could only show up as a third strong reference. The
        // spawn-and-sleep this replaced would have left 50 live threads here.
        assert_eq!(Arc::strong_count(&timer), 2);
    }

    #[test]
    fn an_armed_timer_fires_once() {
        let timer = Timer::spawn();
        let (tx, rx) = mpsc::channel();
        timer.arm(Duration::from_millis(10), move || {
            let _ = tx.send(());
        });

        assert!(rx.recv_timeout(Duration::from_secs(5)).is_ok());
        // The slot was emptied by the fire, so there is no second callback (and
        // no sender) left.
        assert!(rx.recv_timeout(Duration::from_millis(50)).is_err());
    }

    #[test]
    fn disarming_prevents_the_callback() {
        let timer = Timer::spawn();
        let (tx, rx) = mpsc::channel();
        // Long enough that the disarm below certainly lands first, and short
        // enough that the wait after it outlasts the deadline it cancelled.
        timer.arm(Duration::from_millis(200), move || {
            let _ = tx.send(());
        });

        timer.disarm();

        assert!(rx.recv_timeout(Duration::from_millis(600)).is_err());
    }

    // A delay no `Instant` can hold is still an arming, not a crash: the caller
    // is on the main thread and the number came off disk.
    #[test]
    fn an_absurd_delay_does_not_panic() {
        let timer = Timer::spawn();
        timer.arm(Duration::MAX, || {});
    }

    // The worker thread is the only one there is: a callback that panics must
    // not end it, or every later arming is a silent no-op for the whole process
    // (no auto-lock, no clipboard clearing). The panic message on stderr is the
    // caught panic being reported, not a failure.
    #[test]
    fn a_panicking_callback_does_not_kill_the_worker() {
        let timer = Timer::spawn();
        let (tx, rx) = mpsc::channel();
        timer.arm(Duration::from_millis(10), || panic!("callback blew up"));

        // Armed after the first is due, so it lands as a fresh arming on a
        // worker that has just survived the panic rather than replacing it.
        assert!(rx.recv_timeout(Duration::from_millis(200)).is_err());
        timer.arm(Duration::from_millis(10), move || {
            let _ = tx.send(());
        });

        assert!(rx.recv_timeout(Duration::from_secs(5)).is_ok());
    }

    #[test]
    fn re_arming_replaces_the_pending_callback() {
        let timer = Timer::spawn();
        let (tx, rx) = mpsc::channel();
        let stale = tx.clone();
        timer.arm(Duration::from_millis(10), move || {
            let _ = stale.send("stale");
        });
        timer.arm(Duration::from_millis(30), move || {
            let _ = tx.send("fresh");
        });

        assert_eq!(rx.recv_timeout(Duration::from_secs(5)).unwrap(), "fresh");
    }
}
