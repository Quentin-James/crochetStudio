/**
 * Which shell the application is running in.
 *
 * Tauri injects `__TAURI_INTERNALS__` into the page before any of our code runs,
 * which is the documented way to tell the desktop window apart from a browser
 * tab. Two things depend on it, and nothing else should: routing and the service
 * worker.
 */
export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
