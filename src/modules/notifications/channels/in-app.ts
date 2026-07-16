import type { NotificationChannel } from "../channel";

/** The in-app channel has nothing to "send" — the notification row the
 *  dispatcher already wrote to the DB *is* the in-app notification. This
 *  adapter exists so in-app is a first-class, always-on channel in the same
 *  list as email/Telegram/push, not a special case. */
export const inAppChannel: NotificationChannel = {
  name: "in-app",
  isEnabledFor(prefs) {
    return prefs?.inAppEnabled ?? true;
  },
  async send() {
    // no-op — see comment above
  },
};
