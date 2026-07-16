import { Resend } from "resend";
import { getConfig } from "@/core/config";
import type { NotificationChannel } from "../channel";

function formatSubject(payload: { symbol: string; leadDays: number }): string {
  if (payload.leadDays === 1) return `${payload.symbol} reports earnings tomorrow`;
  return `${payload.symbol} reports earnings in ${payload.leadDays} days`;
}

export const emailChannel: NotificationChannel = {
  name: "email",
  isEnabledFor(prefs) {
    return prefs?.emailEnabled ?? true;
  },
  async send(user, payload) {
    const config = getConfig();
    if (!config.RESEND_API_KEY) {
      console.warn("[notifications/email] RESEND_API_KEY not set — skipping email send");
      return;
    }
    const resend = new Resend(config.RESEND_API_KEY);
    await resend.emails.send({
      from: config.NOTIFICATION_FROM_EMAIL,
      to: user.email,
      subject: formatSubject(payload),
      text: `${payload.symbol} is expected to report earnings on ${payload.eventDate} (${payload.leadDays} day${payload.leadDays === 1 ? "" : "s"} from today).`,
    });
  },
};
