import { getConfig } from "@/core/config";
import { getCurrentUser } from "@/core/current-user";
import { getOrCreatePreferences } from "@/modules/notifications/preferences";
import { PreferencesForm } from "./preferences-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const preferences = await getOrCreatePreferences(user.id);
  const config = getConfig();
  const feedUrl = `${config.NEXT_PUBLIC_APP_URL}/api/calendar.ics?token=${config.CALENDAR_FEED_TOKEN}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">Signed in as {user.email}</p>
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Calendar feed</h2>
        <p className="text-sm text-neutral-500">
          Subscribe to this URL in Google Calendar or Apple Calendar to get native reminders on your phone for every
          earnings date. Keep the URL private — it isn&apos;t protected by login, only by the token in the link.
        </p>
        <code className="block break-all rounded bg-neutral-100 px-3 py-2 text-xs dark:bg-neutral-900">{feedUrl}</code>
      </section>

      <section>
        <h2 className="mb-3 font-medium">Notification preferences</h2>
        <PreferencesForm initial={preferences} />
      </section>
    </div>
  );
}
