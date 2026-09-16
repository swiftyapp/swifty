import { describe, expect, it } from 'vitest'
import libRs from '../../src-tauri/src/lib.rs?raw'
import eventsRs from '../../src-tauri/src/events.rs?raw'
import errorRs from '../../src-tauri/src/error.rs?raw'
import errorsTs from './errors.ts?raw'
import e2eTs from '@/lib/e2e.ts?raw'
import { EVENTS } from './events'

// The bridge is written by hand on both sides. This is what keeps the two from
// drifting: every command the webview invokes must be one Rust registers, every
// event it listens for must be one Rust can emit, and every kind a rejection
// can carry must be one the webview knows how to say — and the other way round,
// so nothing is left registered, emitted or translated that no one uses.

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

// The arms of `Error::kind()` — `Error::Locked => "locked",` — read out of the
// function body so an `#[error("…")]` attribute elsewhere in the file cannot be
// mistaken for one.
const kinds = () => {
  const body = errorRs.match(/fn kind\(&self\)[\s\S]*?\n {4}\}/)?.[0] ?? ''
  return names(body, /=>\s*"([A-Za-z]+)"/g)
}

// The `BackendErrorKind` union, up to the blank line that ends it.
const declared = () => names(errorsTs.match(/BackendErrorKind =([\s\S]*?)\n\n/)?.[1] ?? '', /'(\w+)'/g)

// The arms of `describeError`.
const translated = () => names(errorsTs, /case '(\w+)':/g)

// The kinds that deliberately show Rust's message instead of a translation:
// a path, a parser position, a driver's words, or a sentence Rust built for one
// call site. `errors.ts` says why for each; everything else has to be copy the
// user can read in their own language.
const RAW = ['unsupported', 'io', 'serde', 'crypto', 'other']

describe('the Rust/webview contract', () => {
  it('invokes exactly the commands Rust registers', () => {
    expect(invoked()).toEqual(registered())
  })

  it('listens for exactly the events Rust emits', () => {
    expect(Object.values(EVENTS).sort()).toEqual(emitted())
  })

  it('knows exactly the error kinds Rust can return', () => {
    expect(declared()).toEqual(kinds())
  })

  it('translates every kind that is not raw diagnostics', () => {
    expect(translated()).toEqual(kinds().filter(kind => !RAW.includes(kind)))
  })
})
