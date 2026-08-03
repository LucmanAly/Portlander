# performance-interpret

Authenticated, cached DeepSeek narration for deterministic portfolio-performance evidence.

- The browser calculates dollar/percentage results from complete daily snapshots.
- The function validates the evidence, returns cached prose for the same evidence hash, and only
  asks DeepSeek for qualitative wording.
- Generated prose is rejected if it contains digits, `$`, or `%`; exact figures remain owned by
  code and are rendered separately in the UI.
- Requires the existing `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, and `DEEPSEEK_MODEL` secrets.
- Deploy with JWT verification enabled.
