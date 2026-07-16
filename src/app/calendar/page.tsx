import { getCurrentUser } from "@/core/current-user";
import { getAllUpcomingEarningsForUser } from "@/modules/earnings/queries";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await getCurrentUser();
  const events = await getAllUpcomingEarningsForUser(user.id);

  const byMonth = new Map<string, typeof events>();
  for (const event of events) {
    const month = event.eventDate.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), event]);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Upcoming earnings</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every earnings date across your holdings. Subscribe on your phone from{" "}
          <a href="/settings" className="underline">
            Settings
          </a>{" "}
          to get native calendar reminders.
        </p>
      </div>

      {events.length === 0 && <p className="text-sm text-neutral-500">No known upcoming earnings dates yet.</p>}

      {[...byMonth.entries()].map(([month, monthEvents]) => (
        <section key={month}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}
          </h2>
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {monthEvents.map((e) => (
              <li key={`${e.symbol}-${e.eventDate}`} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium">{e.symbol}</span>
                  <span className="ml-2 text-sm text-neutral-500">{e.eventDate}</span>
                  {!e.confirmed && <span className="ml-2 text-xs text-neutral-400">(estimated)</span>}
                </div>
                <span className="text-sm text-neutral-500">
                  {e.daysUntil === 0 ? "today" : e.daysUntil === 1 ? "tomorrow" : `in ${e.daysUntil} days`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
