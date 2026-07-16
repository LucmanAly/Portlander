"use client";

import { useState } from "react";

type Preferences = {
  leadDays: number[];
  emailEnabled: boolean;
  inAppEnabled: boolean;
};

export function PreferencesForm({ initial }: { initial: Preferences }) {
  const [leadDaysText, setLeadDaysText] = useState(initial.leadDays.join(", "));
  const [emailEnabled, setEmailEnabled] = useState(initial.emailEnabled);
  const [inAppEnabled, setInAppEnabled] = useState(initial.inAppEnabled);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSave() {
    setStatus("saving");
    const leadDays = leadDaysText
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);

    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadDays, emailEnabled, inAppEnabled }),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div>
        <label className="block text-xs text-neutral-500">Alert me this many days before earnings</label>
        <input
          value={leadDaysText}
          onChange={(e) => setLeadDaysText(e.target.value)}
          className="mt-1 w-64 rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          placeholder="30, 7, 1"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
        Email notifications
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={inAppEnabled} onChange={(e) => setInAppEnabled(e.target.checked)} />
        In-app notifications
      </label>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={status === "saving"}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        {status === "saved" && <span className="text-sm text-green-600">Saved.</span>}
        {status === "error" && <span className="text-sm text-red-600">Failed to save.</span>}
      </div>
    </div>
  );
}
