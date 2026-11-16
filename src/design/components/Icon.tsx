/**
 * Inline SVG icon set.
 *
 * Icons are inlined rather than loaded from a sprite or icon font so the app
 * has no network dependency and no flash of missing glyphs when offline.
 * All icons are drawn on a 24x24 grid with a 1.6 stroke so they share a weight.
 */

export type IconName =
  | 'dashboard'
  | 'projects'
  | 'pattern'
  | 'cube'
  | 'settings'
  | 'plus'
  | 'search'
  | 'yarn'
  | 'ruler'
  | 'hook'
  | 'chevronRight'
  | 'chevronLeft'
  | 'check'
  | 'copy'
  | 'trash'
  | 'download'
  | 'upload'
  | 'lock'
  | 'unlock'
  | 'refresh'

const paths: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <path d="M4 12.5 12 5l8 7.5" />
      <path d="M6 11.5V19h12v-7.5" />
      <path d="M10 19v-4.5h4V19" />
    </>
  ),
  projects: (
    <>
      <rect x="3.5" y="4.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="4.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="14.5" width="7" height="5" rx="2" />
      <rect x="13.5" y="14.5" width="7" height="5" rx="2" />
    </>
  ),
  pattern: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
      <path d="M8 5.5v3M13 5.5v3M18 5.5v3" />
      <path d="M6 10.5v3M11 10.5v3M16 10.5v3" />
      <path d="M8 15.5v3M13 15.5v3M18 15.5v3" />
    </>
  ),
  cube: (
    <>
      <path d="M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6z" />
      <path d="M4 7.6 12 12l8-4.4" />
      <path d="M12 12v8.8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 7.8l1.9 1.1M17.2 15.1l1.9 1.1M4.9 16.2l1.9-1.1M17.2 8.9l1.9-1.1" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5.5v13M5.5 12h13" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5 20 20" />
    </>
  ),
  yarn: (
    <>
      <circle cx="11" cy="12" r="7" />
      <path d="M6.2 7.4 15.4 17.6M8.2 5.4l8.6 9.4M4.6 10.6l6.6 7.2" />
      <path d="M17.8 15.2c1.4 1 2.2 2.4 2.2 3.8" />
    </>
  ),
  ruler: (
    <>
      <rect x="2.6" y="8.6" width="18.8" height="6.8" rx="1.6" />
      <path d="M7 8.6v2.4M11 8.6v3.4M15 8.6v2.4M19 8.6v3.4" />
    </>
  ),
  hook: (
    <>
      <path d="M8.5 4.5v9.8a3.5 3.5 0 0 0 7 0V12" />
      <path d="M15.5 12a2.2 2.2 0 1 1 2.6-2.2" />
      <path d="M8.5 19.5h7" />
    </>
  ),
  chevronRight: (
    <>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </>
  ),
  chevronLeft: (
    <>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </>
  ),
  check: (
    <>
      <path d="M5 12.8 9.4 17 19 7" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.4" />
      <path d="M15 6.6V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h.6" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7.5h14" />
      <path d="M9.5 7.5V5.2h5v2.3" />
      <path d="M7 7.5l.8 11.3h8.4L17 7.5" />
      <path d="M10.5 11v5M13.5 11v5" />
    </>
  ),
  download: (
    <>
      <path d="M12 4.5v10" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M5 18.5h14" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4.8" />
      <path d="M7.5 9.3 12 4.8l4.5 4.5" />
      <path d="M5 18.5h14" />
    </>
  ),
  lock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9" rx="2.4" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  unlock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9" rx="2.4" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.8-1.2" />
    </>
  ),
  refresh: (
    <>
      <path d="M19 12a7 7 0 1 1-2.4-5.3" />
      <path d="M19.2 4.8v4h-4" />
    </>
  ),
}

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 22, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  )
}
