import { getCurrentUser } from "@/core/current-user";
import { listHoldings } from "@/modules/portfolio/service";
import { getUpcomingEarningsForUser } from "@/modules/earnings/queries";
import { HoldingsTable } from "./holdings-table";

export const dynamic = "force-dynamic";

function badgeClass(daysUntil: number): string {
  if (daysUntil <= 1) return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
  if (daysUntil <= 7) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  if (daysUntil <= 30) return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
  return "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400";
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const [holdings, upcoming] = await Promise.all([
    listHoldings(user.id),
    getUpcomingEarningsForUser(user.id),
  ]);

  const within30 = upcoming.filter((u) => u.daysUntil <= 30);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-xl font-semibold">Earnings within 30 days</h1>
        {within30.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nothing coming up. Run an earnings sync from the daily job, or check back after your first import.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {within30.map((e) => (
              <li key={e.symbol} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium">{e.symbol}</span>
                  <span className="ml-2 text-sm text-neutral-500">{e.eventDate}</span>
                  {!e.confirmed && <span className="ml-2 text-xs text-neutral-400">(estimated)</span>}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass(e.daysUntil)}`}>
                  {e.daysUntil === 0 ? "today" : e.daysUntil === 1 ? "tomorrow" : `${e.daysUntil} days`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Holdings</h2>
        <HoldingsTable initialHoldings={holdings} upcomingBySymbol={Object.fromEntries(upcoming.map((u) => [u.symbol, u]))} />
      </section>
    </div>
  );
}
