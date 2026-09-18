# Claude quota credential lifecycle

Date: 2026-09-17 Status: approved for implementation

## Context

`src/claude-quota.ts` powers the `claude-quota` statusbar section.
`ClaudeQuotaState.startPolling()` polls once on `session_start` and then every
`DEFAULT_POLL_INTERVAL_MS` (300s). Each poll calls `fetchClaudeUsedPercent`,
which resolves a token through `readClaudeAccessToken` in this order:

1. `~/.pi/agent/auth.json`, reading `anthropic.access`
2. macOS keychain, via
   `security find-generic-password -s "Claude Code-credentials" -w`
3. `~/.claude/.credentials.json`, reading `claudeAiOauth.accessToken`

Four issues were found while diagnosing stray `security:` output in the pi TUI.
The stderr leak itself was fixed in #5.

### Finding 1: the token is re-resolved on every poll

`readClaudeAccessToken` runs inside `fetchClaudeUsedPercent`, so the keychain is
read on every poll. Nothing carries the resolved token between polls, even
though the token outlives many of them at a 5 minute interval.

Evidence: 5 `security` spawns per `npm test` run, all from `src/index.test.ts`,
measured with a PATH shim that logged invocations.

### Finding 2: a completed Claude poll does not repaint the footer

`CodexQuotaState.startPolling` accepts an `onComplete` callback and
`src/index.ts:69` passes `requestFooterRender`. `ClaudeQuotaState.startPolling`
accepts nothing and `src/index.ts:42` passes nothing, so a value arriving
between renders is not displayed until some other render trigger fires.

### Finding 3: `anthropic.access` is the only field read

`extractPiAuthToken` reads `parsed.anthropic.access`. Pi writes two shapes
(`@earendil-works/pi-coding-agent/dist/core/auth-storage.js:185-197`):

- `{ type: "oauth", access, refresh }`
- `{ type: "api_key", key }`

An `api_key`-shaped entry is skipped, so the lookup falls through to the
keychain. This is correct rather than an oversight: the usage endpoint at
`https://api.anthropic.com/api/oauth/usage` is OAuth-only, so an API key sent as
a Bearer token would be rejected. The behaviour needs documenting and pinning,
not changing.

### Finding 4: the test suite performs real keychain I/O

`src/index.test.ts` calls `extension(pi, mockQuotaState)`, injecting only the
Codex factory. The Claude factory keeps its default, so every `session_start` in
the test constructs a real `ClaudeQuotaState` and starts polling.
`DEFAULT_STATUSBAR_CONFIG.sections` (`src/config.ts:8`) includes `claude-quota`,
and `loadStatusbarConfig` falls back to those defaults when
`~/.pi/agent/statusbar.json` is absent.

Evidence: 5 `security` spawns per `index.test.ts` run, measured the same way. On
a machine whose keychain holds Claude Code credentials the same tests would also
issue live HTTPS requests to `api.anthropic.com`, since the real token reaches
`fetch` with no fetch implementation injected. That network step is inferred
from the code path, not measured.

## Decisions

1. **Token memo.** Resolve the token once per `ClaudeQuotaState` and reuse it.
   Drop the memo whenever a poll yields no value so the next poll re-resolves. A
   failed poll, including a transient network blip, therefore costs one extra
   keychain read. Chosen over a result type that invalidates only on 401 or 403:
   that would be more precise but changes `fetchClaudeUsedPercent`'s return
   shape and its existing tests.
2. **Auth shape.** Keep the `api_key` skip. Document the rationale in a comment
   and pin it with a characterization test. Do not accept `anthropic.key` as a
   Bearer token.
3. **Test hygiene.** Fold Finding 4 into Finding 2's task, since that task
   already touches `src/index.ts` and needs a Claude factory injected in
   `index.test.ts` in order to assert the render callback.
4. **Delivery.** One branch, one PR, three commits. This deviates from
   CONTRIBUTING.md's "One change per PR", so the PR body must say so.

## Non-goals

- Refreshing an expired pi OAuth token. The memo is dropped on failure and the
  next poll re-reads `auth.json`, which pi keeps refreshed. Nothing here calls a
  refresh endpoint.
- Changing the poll interval, the stale TTL, or the request timeout.
- Caching the token to disk, or anywhere outside the `ClaudeQuotaState`
  instance.
- Touching `src/codex-quota.ts`. Its `startPolling` already takes the callback
  and it already passes `stdio` explicitly.
- Adding a Prettier or ESLint config.

## Constraints

- No new exports from `src/claude-quota.ts`.
- Exported signatures are frozen: `readClaudeAccessToken`,
  `fetchClaudeUsedPercent`, `parseSpendPercent`, `CLAUDE_USAGE_ENDPOINT`.
- New `ClaudeQuotaState` constructor parameters go after `staleTtlMs`. The
  existing suite constructs it positionally.
- Baseline: `main` at `6252037` is green at 14 files / 92 tests. Target after
  all three tasks is 98 tests.
- `npm test` must spawn the `security` binary zero times.
