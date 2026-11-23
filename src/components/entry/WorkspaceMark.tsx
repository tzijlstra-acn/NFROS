/**
 * The NFR Workspace mark: a doorway with a point of light above it.
 *
 * The same drawing as `public/brand/favicon.svg`, as a component so the
 * startup sequence can draw the arch and light the point. Abstract on
 * purpose; no real trademark artwork belongs in a synthetic product.
 */

export function WorkspaceMark({ size = 40, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg
      className="ws-mark"
      data-animated={animated ? "true" : undefined}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="ws-mark-tile" width="32" height="32" rx="7" />
      <path
        className="ws-mark-arch"
        d="M9 23V13.5a7 7 0 0 1 14 0V23"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        pathLength={1}
      />
      <circle className="ws-mark-point" cx="16" cy="8.6" r="2" />
    </svg>
  );
}
