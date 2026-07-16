"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Holding = {
  id: string;
  symbol: string;
  quantity: string;
  costBasis: string | null;
  accountLabel: string | null;
};

type UpcomingBySymbol = Record<string, { eventDate: string; daysUntil: number }>;

export function HoldingsTable({
  initialHoldings,
  upcomingBySymbol,
}: {
  initialHoldings: Holding[];
  upcomingBySymbol: UpcomingBySymbol;
}) {
  const router = useRouter();
  const [holdings, setHoldings] = useState(initialHoldings);
  const [form, setForm] = useState({ symbol: "", quantity: "", costBasis: "", accountLabel: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.symbol.trim() || !form.quantity.trim()) {
      setError("Symbol and quantity are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: form.symbol.trim().toUpperCase(),
          quantity: Number(form.quantity),
          costBasis: form.costBasis.trim() ? Number(form.costBasis) : null,
          accountLabel: form.accountLabel.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ? JSON.stringify(body.error) : "Failed to add holding");
      }
      const { holding } = await res.json();
      setHoldings((prev) => [...prev, holding]);
      setForm({ symbol: "", quantity: "", costBasis: "", accountLabel: "" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add holding");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
    await fetch(`/api/holdings/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2">Symbol</th>
              <th className="px-4 py-2">Quantity</th>
              <th className="px-4 py-2">Cost basis</th>
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2">Next earnings</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {holdings.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  No holdings yet. Add one below or import a Fidelity CSV.
                </td>
              </tr>
            )}
            {holdings.map((h) => {
              const upcoming = upcomingBySymbol[h.symbol];
              return (
                <tr key={h.id}>
                  <td className="px-4 py-2 font-medium">{h.symbol}</td>
                  <td className="px-4 py-2">{h.quantity}</td>
                  <td className="px-4 py-2">{h.costBasis ?? "—"}</td>
                  <td className="px-4 py-2 text-neutral-500">{h.accountLabel ?? "—"}</td>
                  <td className="px-4 py-2 text-neutral-500">
                    {upcoming ? `${upcoming.eventDate} (${upcoming.daysUntil}d)` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(h.id)}
                      className="text-neutral-400 hover:text-red-600"
                      aria-label={`Remove ${h.symbol}`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <div>
          <label className="block text-xs text-neutral-500">Symbol</label>
          <input
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value })}
            className="w-24 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="AAPL"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Quantity</label>
          <input
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            className="w-24 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="10"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Cost basis</label>
          <input
            value={form.costBasis}
            onChange={(e) => setForm({ ...form, costBasis: e.target.value })}
            className="w-28 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="optional"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Account</label>
          <input
            value={form.accountLabel}
            onChange={(e) => setForm({ ...form, accountLabel: e.target.value })}
            className="w-36 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="optional"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {submitting ? "Adding…" : "Add holding"}
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
