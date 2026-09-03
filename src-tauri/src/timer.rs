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
        *self.lock() = Some(Armed {
            at: Instant::now() + after,
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
                        fire();
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
