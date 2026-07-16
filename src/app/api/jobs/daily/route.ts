import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/core/config";
import { syncEarningsForHoldings } from "@/modules/earnings/sync";
import { runEarningsWatcher } from "@/modules/earnings/watcher";
import { registerNotificationListeners } from "@/modules/notifications/dispatcher";
import { cachePurgeExpired } from "@/modules/market-data/cache";

export const maxDuration = 60;

/** Triggered daily by Vercel Cron (see vercel.json), which always sends a
 *  GET request and automatically attaches `Authorization: Bearer
 *  $CRON_SECRET` when the CRON_SECRET env var is set. Two phases, run in
 *  order: sync fresh earnings dates for held symbols, then scan for holdings
 *  entering an alert window and notify. POST is also supported for manual
 *  triggering (e.g. `curl -X POST` while testing locally). */
async function runDailyJob(request: NextRequest) {
  const config = getConfig();
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${config.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  registerNotificationListeners();

  const syncResult = await syncEarningsForHoldings();
  const watchResult = await runEarningsWatcher();
  await cachePurgeExpired();

  return NextResponse.json({
    ok: true,
    sync: syncResult,
    watch: watchResult,
  });
}

export const GET = runDailyJob;
export const POST = runDailyJob;
