import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/core/db/client";
import { getConfig } from "@/core/config";
import { getCurrentUser } from "@/core/current-user";

function icsDate(iso: string): string {
  return iso.replace(/-/g, "");
}

function nowStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** RFC 5545 requires folding lines longer than 75 octets with a leading
 *  space on the continuation. Most calendar apps tolerate long lines, but
 *  folding keeps us compliant for the strict ones. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75));
    rest = " " + rest.slice(75);
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

function buildEvent(symbol: string, eventDate: string): string {
  const dtStart = icsDate(eventDate);
  const dtEndDate = new Date(`${eventDate}T00:00:00Z`);
  dtEndDate.setUTCDate(dtEndDate.getUTCDate() + 1);
  const dtEnd = icsDate(dtEndDate.toISOString().slice(0, 10));

  const lines = [
    "BEGIN:VEVENT",
    `UID:${symbol}-${eventDate}@portlander`,
    `DTSTAMP:${nowStamp()}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${symbol} earnings`,
    `DESCRIPTION:${symbol} is expected to report earnings on ${eventDate}.`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${symbol} reports earnings today`,
    "TRIGGER:-P0D",
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${symbol} reports earnings in 7 days`,
    "TRIGGER:-P7D",
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${symbol} reports earnings in 30 days`,
    "TRIGGER:-P30D",
    "END:VALARM",
    "END:VEVENT",
  ];
  return lines.map(foldLine).join("\r\n");
}

/** Subscribe to this URL (with its token) from Google/Apple Calendar to get
 *  native phone reminders for every holding's earnings date — no push
 *  infrastructure required. Protected by a random token in the query
 *  string since calendar subscriptions can't send an Authorization header. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const config = getConfig();
  if (!token || token !== config.CALENDAR_FEED_TOKEN) {
    return new NextResponse("Not found", { status: 404 });
  }

  const user = await getCurrentUser();
  const today = new Date().toISOString().slice(0, 10);

  const rows = await db
    .selectDistinct({
      symbol: schema.earningsEvents.symbol,
      eventDate: schema.earningsEvents.eventDate,
    })
    .from(schema.holdings)
    .innerJoin(schema.earningsEvents, eq(schema.earningsEvents.symbol, schema.holdings.symbol))
    .where(eq(schema.holdings.userId, user.id));

  const upcoming = rows.filter((r) => r.eventDate >= today);

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Portlander//Earnings Calendar//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Portlander Earnings",
    ...upcoming.map((r) => buildEvent(r.symbol, r.eventDate)),
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="portlander-earnings.ics"',
    },
  });
}
