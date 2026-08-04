/**
 * Release metadata shown in Settings.
 *
 * Update APP_VERSION, APP_RELEASE_NAME, and APP_LAST_UPDATED together
 * whenever a release is promoted to main. APP_LAST_UPDATED is an ISO-8601
 * UTC timestamp; the UI formats it for America/New_York.
 *
 * APP_RELEASE_NAME is a short descriptive name for the release — deliberately
 * not "Phase N", per the owner's call when promoting v2.0 (2026-08-02): the
 * "Phase" numbering is internal project-planning language (AGENTS.md/
 * PROGRESS.md), not something that belongs in front of a user.
 */
export const APP_VERSION = '2.1'
export const APP_RELEASE_NAME = 'Everyday Usability'
export const APP_LAST_UPDATED = '2026-08-04T10:50:26Z'

export function formatAppUpdatedAt(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  }).format(new Date(iso))
}
