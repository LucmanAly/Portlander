import type { schema } from "@/core/db/client";

export type NotificationPreferencesRow = typeof schema.notificationPreferences.$inferSelect;
export type UserRow = typeof schema.users.$inferSelect;

export type NotificationPayload = {
  symbol: string;
  eventDate: string;
  leadDays: number;
};

/** One adapter per delivery mechanism. Adding a channel (Telegram, Web Push,
 *  SMS...) means implementing this interface and registering it in
 *  dispatcher.ts — nothing else in the notification pipeline changes. */
export interface NotificationChannel {
  readonly name: string;
  isEnabledFor(prefs: NotificationPreferencesRow | undefined): boolean;
  send(user: UserRow, payload: NotificationPayload): Promise<void>;
}
