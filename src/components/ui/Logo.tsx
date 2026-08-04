/**
 * The "event-orbit P" mark: a stem + a partial ring standing in for the
 * bowl of the P, with one bright dot on the ring for "the event that
 * matters next." Same idea as the calendar's weighted dots, at brand scale.
 * Renders at any size via `className` — callers set width/height.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-ink-950" />
      <rect x="1" y="1" width="30" height="30" rx="7" stroke="currentColor" strokeOpacity="0.35" className="text-accent-500" />
      {/* Stem + bowl of a "P", drawn as one open outline rather than filled —
          the hollow bowl reads as the orbit ring, with the dot riding its
          curve as the next event on that ring. */}
      <path
        d="M11 25V7h3.5a5.5 5.5 0 0 1 0 11H11"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent-400"
      />
      <circle cx="19.5" cy="12.5" r="2.1" className="fill-amber-400" />
    </svg>
  )
}
