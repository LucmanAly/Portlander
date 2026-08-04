# Performance briefings: reliability and implementation

## Verdict

The feature is reliable **from the first complete Portlander snapshot onward**. DeepSeek is the
narrator, not the calculator. Existing Fidelity/SnapTrade data can strengthen or backfill a
whole-account headline, but it cannot by itself recreate historical cybersecurity/quantum/crypto
attribution for arbitrary dates.

| Question | Reliable source | What Portlander does |
|---|---|---|
| What is the book worth now? | Current holdings + Finnhub quote | Deterministic sum in code |
| What moved today? | Finnhub `c`, `d`, `dp`, `pc` per current position | Exact position/theme contribution when every position is covered |
| What moved this week or a selected period? | Portlander's daily position snapshots | Sum daily market P&L; compound daily returns |
| What did the brokerage report for 1D/1W? | SnapTrade connection return rates | Optional future cross-check/headline, not theme attribution |
| Can old account totals be backfilled? | SnapTrade beta balance history, max one year | Optional future total-value backfill; label beta/estimated |
| Can old theme attribution be backfilled? | Not from current endpoints alone | No. It needs old positions plus old prices and transaction/cash-flow reconstruction |
| What caused the move? | Verified events/news, if separately sourced | Not implemented here; price movement is not proof of causation |
| Who writes the prose? | DeepSeek JSON output | Cached qualitative wording; digit-bearing generated claims are rejected |

## Provider findings

- SnapTrade exposes broker-sourced returns for `1D`, `1W`, `1M`, `YTD`, `1Y`, and `ALL` at
  `GET /authorizations/{authorizationId}/returnRates`.
- SnapTrade's beta `GET /accounts/{accountId}/balanceHistory` returns estimated historical total
  account value, is disabled by default, and documents a maximum one-year lookback.
- SnapTrade account activities provide transactions, but reconstructing exact historical positions,
  transfers, corporate actions, and tax lots is a separate accounting-grade project.
- Fidelity's publicly discoverable WorkplaceXchange APIs are workplace/retirement integration APIs,
  not the retail Fidelity brokerage interface Portlander needs. Keep SnapTrade as the brokerage
  connection boundary.
- Finnhub owns quotes and broad company profile/industry metadata. Existing holding `tags` remain
  the truthful source for custom themes such as `quantum`, `cyber`, and `crypto`; broad provider
  industries do not reliably encode investment themes.
- DeepSeek JSON mode can constrain output shape, but its own documentation notes that an empty
  response is still possible. Portlander therefore treats generated prose as optional.

Official references:

- https://docs.snaptrade.com/reference/Connections/Connections_returnRates
- https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getAccountBalanceHistory
- https://docs.snaptrade.com/reference/Account%20Information/AccountInformation_getAccountActivities
- https://workplacexchange.fidelity.com/public/wpx/api-catalog
- https://finnhub.io/docs/api/quote
- https://finnhub.io/docs/api/company-profile2
- https://api-docs.deepseek.com/guides/json_mode/

## Calculation contract

For each complete market-day snapshot:

```text
position day P&L = shares at capture × Finnhub per-share day change
daily return      = sum(position day P&L) / sum(shares × previous close)
period return     = compound each captured daily return
period dollar P&L = sum each captured position day P&L
```

Deposits and withdrawals are not gains. The daily-return compounding reduces cash-flow distortion,
while period dollar P&L deliberately describes captured **market movement**, not the raw difference
between ending and starting account value. Intraday trades remain a disclosed limitation.

Theme tags can overlap; `cyber` and `core` may both include the same holding. Theme rows are useful
attribution lenses and are not required to add up to the portfolio total.

Cash-sweep tickers such as `SPAXX` are captured at their stored $1 price with zero daily movement
when Finnhub does not support them. A quote with a missing/sentinel timestamp may join only the
dominant market session established by the other timestamped quotes in the same refresh. A genuinely
stale/outlier timestamp remains uncovered; Portlander does not relabel it as current.

## Product placement

- **Today / Morning Desk:** weekday live daily briefing; weekend completed/current Monday–Friday
  briefing from stored snapshots.
- **Period review (`/performance`):** two date inputs, exact whole-book movement, top themes and
  holdings, coverage/limitations, and separately labeled generated narrative.
- **No silent fallback:** incomplete coverage withholds the whole-book total; no snapshot shows an
  instructional state; DeepSeek failure leaves all verified figures usable.
