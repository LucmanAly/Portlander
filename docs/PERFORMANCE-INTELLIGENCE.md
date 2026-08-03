# Portfolio performance intelligence

## Product decision

Portlander owns a daily, user-scoped per-position snapshot ledger. Provider
data supplies holdings and prices; deterministic code owns every value,
percentage, grouping, and warning; DeepSeek only writes a separately labeled
qualitative narrative.

## What each source can reliably do

| Source | Reliable use | Important limit |
|---|---|---|
| SnapTrade/Fidelity connection | Current accounts, positions, balances and daily-cached activities | This is Portlander's Fidelity bridge; there is no separate Fidelity retail API integration in the app |
| [SnapTrade account detail](https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getUserAccountDetails) | Brokerage-sourced current total account value; sync freshness | A current state, not per-position historical attribution |
| [SnapTrade historical total value](https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getAccountBalanceHistory) | Reconcile Portlander's whole-account history | Beta, experimental, disabled by default, at most one year, and total value only |
| [SnapTrade account activities](https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getAccountActivities) | Later identify deposits, withdrawals, buys and sells for cash-flow-adjusted returns | Daily cached; transaction coverage starts only as far back as the brokerage exposes |
| Finnhub quote (existing `refresh-quotes`) | Current price plus verified day dollar/% move for each ticker | Not a portfolio-history store |
| [Finnhub stock candles](https://finnhub.io/docs/api/stock-candles) | Potential historical market-price backfill | Premium endpoint; do not make the core feature depend on it |
| Finnhub company profile / holding tags | Broad provider industry plus owner-defined thematic classification | “Quantum,” “crypto-related,” and “cybersecurity” are investment themes, not reliably inferred from a broad industry field; owner tags remain authoritative |
| [DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/) | Strictly shaped qualitative narration | Valid JSON is not factual verification; model output never supplies a rendered number |

## Implemented data flow

1. A successful, complete **Refresh prices** run updates every holding.
2. The same authenticated Edge Function creates an incomplete snapshot header,
   writes every position row, then marks the capture complete.
3. Readers ignore incomplete captures.
4. On weekdays, Morning Desk uses the complete live Finnhub day deltas.
5. On weekends, it compares the week's first and latest complete captures.
6. Portfolio → Performance history compares the first and latest complete
   capture inside any selected date range.
7. Exact ticker and tag/theme attribution is computed in TypeScript.
8. DeepSeek receives only labels, gain/loss direction, and rank. Its digit-free
   response is cached by summary fingerprint. The UI renders verified numbers
   independently from the model.

## Truth boundaries shown in the UI

- History begins with Portlander's first complete capture; missing past data is
  never reconstructed from current holdings.
- A period with changed tickers or share quantities is labeled **portfolio
  value change**, not investment return, because trades or cash flows may be
  included.
- A future transaction-ledger pass can add time-weighted or Modified Dietz
  return. Until then, Portlander does not pretend the two concepts are equal.
- Multiple holding tags can overlap. Theme rows therefore do not have to sum to
  the portfolio total.
- A partial quote refresh never creates a complete snapshot or whole-book recap.

## Placement

- **Today / Morning Desk:** directly under total value and today's gain/loss;
  weekday daily recap, weekend whole-week recap.
- **Portfolio:** Performance history card immediately after the holdings table,
  with From/To date controls and an Analyze period action.

## Sensible next accuracy upgrade

Add SnapTrade activities ingestion and compute a cash-flow-adjusted return
alongside value change. Use SnapTrade's beta account-total history only to
reconcile the daily totals—not to invent per-holding or theme attribution it
does not provide.
