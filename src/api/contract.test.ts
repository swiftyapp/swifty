import { describe, expect, it } from 'vitest'
import libRs from '../../src-tauri/src/lib.rs?raw'
import eventsRs from '../../src-tauri/src/events.rs?raw'
import e2eTs from '@/lib/e2e.ts?raw'
import { EVENTS } from './events'

// The bridge is written by hand on both sides. This is what keeps the two from
// drifting: every command the webview invokes must be one Rust registers, and
// every event it listens for must be one Rust can emit — and the other way
// round, so nothing is left registered or emitted that no one uses.

const api = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true })

// A set: one command invoked from two places is still one command.
const names = (source: string, pattern: RegExp) =>
  [...new Set([...source.matchAll(pattern)].map(m => m[1]))].sort()

const invoked = () => {
  const sources = Object.entries(api)
    .filter(([path]) => !path.endsWith('.test.ts'))
    .map(([, source]) => source as string)
  return names(
    [...sources, e2eTs].join('\n'),
    /\b(?:call|invoke)(?:<[^>]*>)?\(\s*'([a-z_0-9]+)'/g
  )
}

const registered = () => {
  // Up to the `])` that closes the macro: a `#[cfg(...)]` inside it has a `]` too.
  const list = libRs.match(/generate_handler!\[([\s\S]*?)\]\)/)?.[1] ?? ''
  return names(list, /::([a-z_0-9]+),?\s*$/gm)
}

const emitted = () => names(eventsRs, /"([a-z]+(?::[a-z]+)+)"/g)

describe('the Rust/webview contract', () => {
  it('invokes exactly the commands Rust registers', () => {
    expect(invoked()).toEqual(registered())
  })

  it('listens for exactly the events Rust emits', () => {
    expect(Object.values(EVENTS).sort()).toEqual(emitted())
  })
})
