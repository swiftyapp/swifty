import { vi } from 'vitest'
import type { EventName, EventPayloads } from '@/api/events'

/**
 * The backend's event stream, faked.
 *
 * `@/api/events`'s `on` is mocked onto this (see `test/setup.ts`), so events
 * reach the app through the path it really subscribes on. That matters for the
 * commands Rust follows with an event — `lock` and `workspace_select` both emit
 * `vault:locked`, and the frontend does nothing about a lock until it arrives —
 * so the fake backend emits them too (see `test/ipc.ts`).
 *
 * The mock is still a `vi.fn`, so a spec that would rather reach in and call the
 * handler it registered (`store/events.test.ts`) can go on doing that.
 */

type AnyHandler = (payload: never) => void

const handlers = new Map<string, Set<AnyHandler>>()

/** The `unlisten` every subscription handed back, in subscription order. */
export const unlistens: (() => void)[] = []

export const onMock = vi.fn((event: string, handler: AnyHandler) => {
  const set = handlers.get(event) ?? new Set()
  set.add(handler)
  handlers.set(event, set)
  const unlisten = vi.fn(() => set.delete(handler))
  unlistens.push(unlisten)
  return Promise.resolve(unlisten)
})

/** Push an event at everything currently listening for it. */
export const emitEvent = <E extends EventName>(event: E, payload: EventPayloads[E]): void => {
  handlers.get(event)?.forEach(handler => (handler as (p: EventPayloads[E]) => void)(payload))
}

/**
 * The same, one microtask later — which is the order the real app sees: a
 * command's promise resolves in the webview before the event the backend
 * emitted inside it is delivered.
 */
export const emitEventSoon = <E extends EventName>(event: E, payload: EventPayloads[E]): void => {
  void Promise.resolve().then(() => emitEvent(event, payload))
}

export const resetEvents = (): void => {
  handlers.clear()
  unlistens.length = 0
}
