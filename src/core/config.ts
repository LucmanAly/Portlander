import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  FINNHUB_API_KEY: z.string().optional(),
  ALPHAVANTAGE_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  NOTIFICATION_FROM_EMAIL: z.string().optional().default("Portlander <alerts@portlander.app>"),
  CRON_SECRET: z.string().min(1, "CRON_SECRET is required"),
  CALENDAR_FEED_TOKEN: z.string().min(1, "CALENDAR_FEED_TOKEN is required"),
  NEXT_PUBLIC_APP_URL: z.string().optional().default("http://localhost:3000"),
  // Single-tenant deployment: the one user this instance serves.
  APP_USER_EMAIL: z.string().min(1, "APP_USER_EMAIL is required"),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Validates process.env once and caches the result. Throws with a readable
 *  message if a required variable is missing — fail fast at boot, not mid-request. */
export function getConfig(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
