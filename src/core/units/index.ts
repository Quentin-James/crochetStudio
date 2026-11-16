import type { UnitSystem } from '../types'

/**
 * Unit conversion and display.
 *
 * Everything in the domain is stored in centimetres. These helpers are the only
 * place where imperial values exist, and they are used at the UI boundary.
 */

const CM_PER_INCH = 2.54

export const cmToInches = (cm: number): number => cm / CM_PER_INCH
export const inchesToCm = (inches: number): number => inches * CM_PER_INCH

/** Converts a stored (cm) value into the user's display unit. */
export function fromCm(cm: number, units: UnitSystem): number {
  return units === 'metric' ? cm : cmToInches(cm)
}

/** Converts a value the user typed in their display unit back to storage (cm). */
export function toCm(value: number, units: UnitSystem): number {
  return units === 'metric' ? value : inchesToCm(value)
}

export function unitLabel(units: UnitSystem): string {
  return units === 'metric' ? 'cm' : 'in'
}

/** Rounds to a fixed number of decimals without floating-point drift. */
export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/**
 * Formats a stored length for display, e.g. `formatLength(40, 'imperial')` → `15.7 in`.
 * Metric shows one decimal only when it carries information.
 */
export function formatLength(cm: number, units: UnitSystem, withUnit = true): string {
  const value = fromCm(cm, units)
  const decimals = units === 'metric' ? (Number.isInteger(value) ? 0 : 1) : 1
  const text = value.toFixed(decimals)
  return withUnit ? `${text} ${unitLabel(units)}` : text
}

/** Human-readable byte size, used by the storage report. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['kB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`
}

/** Parses user input, tolerating a comma decimal separator and a trailing unit. */
export function parseLength(input: string, units: UnitSystem): number | null {
  const cleaned = input.replace(',', '.').replace(/[^\d.\-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value)) return null
  return toCm(value, units)
}
