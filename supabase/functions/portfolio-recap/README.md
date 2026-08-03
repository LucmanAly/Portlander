# portfolio-recap

Authenticated, user-scoped DeepSeek narration for deterministic portfolio
performance summaries. The browser supplies only fact labels, directions, and
ranks; no shares, prices, dollar values, percentages, or account identifiers
are sent to the model. Numeric output is rejected and verified values remain a
separate client-rendered layer.

Requires `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, and the
standard Supabase function secrets. Keep `verify_jwt: true`.
