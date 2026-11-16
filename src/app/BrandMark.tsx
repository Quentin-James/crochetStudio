import './BrandMark.css'

/**
 * The studio mark: a ball of yarn with a hook resting against it.
 * Drawn inline so it scales crisply and needs no asset request.
 */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      className="cs-brand-mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="21" cy="26" r="15" fill="var(--pink-soft)" stroke="var(--pink-deep)" strokeWidth="1.4" />
      <g stroke="var(--pink-deep)" strokeWidth="1.1" strokeLinecap="round" opacity="0.85">
        <path d="M9.2 20.2 32.8 36.4" />
        <path d="M12.8 15.2 35 31" />
        <path d="M7.2 26.6 24.6 40" />
        <path d="M18 11.4 34.6 24.6" />
      </g>
      <path
        d="M33 10v12.5a4.4 4.4 0 0 1-8.8 0"
        stroke="var(--muted-brown)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M33 10a2.8 2.8 0 1 1 3.4-2.6"
        stroke="var(--muted-brown)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
