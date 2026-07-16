"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ParsedHolding = { symbol: string; quantity: number; costBasis: number | null; accountLabel: string | null };
type PreviewResult = { parsed: ParsedHolding[]; skipped: { row: string; reason: string }[] };

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState<{ holdingsWritten: number } | null>(null);

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setCommitted(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("commit", "false");
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to parse file");
      setPreview(body.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("commit", "true");
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to import");
      setCommitted({ holdingsWritten: body.holdingsWritten });
      setPreview(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Import from Fidelity</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Fidelity → Accounts &amp; Trade → Portfolio → Positions → Download. Upload the CSV here. Re-importing an
          account replaces its holdings rather than duplicating them.
        </p>
      </div>

      <form onSubmit={handlePreview} className="space-y-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setCommitted(null);
          }}
          className="block text-sm"
        />
        <button
          type="submit"
          disabled={!file || busy}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {busy ? "Parsing…" : "Preview"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {committed && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          Imported {committed.holdingsWritten} holdings.
        </p>
      )}

      {preview && (
        <div className="space-y-3">
          <h2 className="font-medium">
            Found {preview.parsed.length} holdings
            {preview.skipped.length > 0 ? ` (skipped ${preview.skipped.length} rows)` : ""}
          </h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2">Symbol</th>
                  <th className="px-4 py-2">Quantity</th>
                  <th className="px-4 py-2">Cost basis</th>
                  <th className="px-4 py-2">Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {preview.parsed.map((h, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 font-medium">{h.symbol}</td>
                    <td className="px-4 py-2">{h.quantity}</td>
                    <td className="px-4 py-2">{h.costBasis ?? "—"}</td>
                    <td className="px-4 py-2 text-neutral-500">{h.accountLabel ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleCommit}
            disabled={busy}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {busy ? "Importing…" : `Confirm import of ${preview.parsed.length} holdings`}
          </button>
        </div>
      )}
    </div>
  );
}
