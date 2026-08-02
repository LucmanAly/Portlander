import { Link } from 'react-router-dom'

/** Generalized from TodayPage's original EmptyHoldings — one honest empty-state card, reused wherever a route has nothing to show. */
export function EmptyState({
  title,
  description,
  ctaLabel,
  ctaTo,
}: {
  title: string
  description: string
  ctaLabel?: string
  ctaTo?: string
}) {
  return (
    <div className="surface-elevated rounded-2xl px-6 py-14 text-center">
      <h2 className="text-xl font-semibold text-ink-100">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">{description}</p>
      {ctaLabel && ctaTo ? (
        <Link
          to={ctaTo}
          className="focus-ring mt-6 inline-flex rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-accent-400"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  )
}
