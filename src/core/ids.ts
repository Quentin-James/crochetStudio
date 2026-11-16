import type { Id } from './types'

/**
 * Identifier generation.
 *
 * `crypto.randomUUID` is available in every target (Chrome, Edge, iPad Safari 15.4+
 * and Node), but it needs a secure context; the fallback keeps a LAN dev server
 * reached over plain http from breaking.
 */
export function newId(): Id {
  const cryptoObj = globalThis.crypto
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID()
  }
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = cryptoObj.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  throw new Error('No secure random source available for id generation')
}
