/**
 * Release metadata shown in Settings.
 *
 * Update APP_VERSION and APP_LAST_UPDATED together whenever a release is
 * promoted to main. APP_LAST_UPDATED is an ISO-8601 UTC timestamp; the UI
 * formats it for America/New_York.
 */
export const APP_VERSION = '1.0'
export const APP_PHASE = 'Phase 1 · Foundation'
export const APP_LAST_UPDATED = '2026-08-01T22:10:00Z'

export function formatAppUpdatedAt(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  }).format(new Date(iso))
}
