import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/core/current-user";
import { fidelityCsvImporter } from "@/modules/portfolio/import/fidelity-csv";
import { replaceHoldingsForAccount } from "@/modules/portfolio/service";

/** Accepts a Fidelity Positions CSV export as multipart/form-data (field
 *  name "file"), previews or commits the parsed holdings depending on the
 *  `commit` field. Re-importing the same account label replaces its
 *  holdings rather than duplicating them. */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const commit = formData.get("commit") === "true";
  const accountLabelOverride = formData.get("accountLabel");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const text = await file.text();

  let result;
  try {
    result = fidelityCsvImporter.parse(text);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse CSV" },
      { status: 400 }
    );
  }

  if (!commit) {
    return NextResponse.json({ preview: result });
  }

  const user = await getCurrentUser();

  // Group by account label so each account's holdings are replaced
  // independently — importing a Roth IRA export doesn't wipe a brokerage
  // account's holdings that came from a separate file.
  const byAccount = new Map<string | null, typeof result.parsed>();
  for (const holding of result.parsed) {
    const label =
      typeof accountLabelOverride === "string" && accountLabelOverride.length > 0
        ? accountLabelOverride
        : holding.accountLabel;
    byAccount.set(label, [...(byAccount.get(label) ?? []), holding]);
  }

  let totalWritten = 0;
  for (const [accountLabel, holdings] of byAccount) {
    const written = await replaceHoldingsForAccount(user.id, accountLabel, holdings);
    totalWritten += written.length;
  }

  return NextResponse.json({ committed: true, holdingsWritten: totalWritten, skipped: result.skipped });
}
