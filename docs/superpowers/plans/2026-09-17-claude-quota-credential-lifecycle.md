# Claude Quota Credential Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the Claude quota section from re-reading the keychain on every
poll, make a completed poll repaint the footer, and pin the deliberate skip of
API-key-shaped credentials.

**Architecture:** Three independent changes. Two touch `src/claude-quota.ts`.
The HTTP request moves out of `fetchClaudeUsedPercent` into a module-private
`requestClaudeUsage(token, fetchFn)` so `ClaudeQuotaState` can own a memoized
token, and `startPolling` gains the same `onComplete` callback that
`CodexQuotaState` already has. The third change is comment-and-test only.

**Tech Stack:** TypeScript (strict), Node 26, Vitest 3. This repo has no
Prettier and no ESLint.

**Spec:**
`docs/superpowers/specs/2026-09-17-claude-quota-credential-lifecycle-design.md`

## Global Constraints

- Baseline before starting: on `main` at commit `6252037`, `npm test` is green
  at 14 files / 92 tests. Confirm this before touching anything.
- Every task ends with the full suite green. Final target is 98 tests.
- Conventional Commit prefixes are required (`fix:`, `test:`). CONTRIBUTING.md
  mandates them and release-it reads them for `CHANGELOG.md`.
- `src/claude-quota.ts` must gain **no new exports**. `requestClaudeUsage` is
  module-private.
- These exported signatures are frozen: `readClaudeAccessToken`,
  `fetchClaudeUsedPercent`, `parseSpendPercent`, `CLAUDE_USAGE_ENDPOINT`.
- New `ClaudeQuotaState` constructor parameters go **after** `staleTtlMs`.
  `src/claude-quota.test.ts` constructs it positionally as
  `(fetcher, now, pollIntervalMs, staleTtlMs)`.
- `npm test` must spawn the `security` binary **zero** times once Task 2 is
  complete. It spawns 5 times today. Verify with the shim in Task 2, step 6.
- Match surrounding style. Do not reformat unrelated lines.
- Delivery: branch `fix/claude-quota-credential-lifecycle` off `main`, three
  commits, one PR. This deviates from CONTRIBUTING.md's one-change-per-PR rule;
  the PR body must state the deviation.

## Task 1: Memoize the Claude access token

**Files:**

- Modify: `src/claude-quota.ts` (the `fetchClaudeUsedPercent` block, and
  `ClaudeQuotaState`)
- Test: `src/claude-quota.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  - module-private
    `async function requestClaudeUsage(token: string, fetchFn?: typeof fetch): Promise<number | undefined>`
  - `ClaudeQuotaState` constructor becomes
    `(fetcher: (token: string) => Promise<number | undefined>, now: () => number, pollIntervalMs: number, staleTtlMs: number, readToken: () => string | undefined)`,
    every parameter optional with a default.
  - Task 2 depends on this parameter order not changing.

- [ ] **Step 0: Create the branch**

```bash
git checkout main && git pull
git checkout -b fix/claude-quota-credential-lifecycle
npm test
```

Expected: `Test Files 14 passed (14)` / `Tests 92 passed (92)`.

- [ ] **Step 1: Update the existing state test and add three new ones**

In `src/claude-quota.test.ts`, in the test named
`"prevents overlap, expires stale values, and cleans up"`, change the
`ClaudeQuotaState` construction to pass a stubbed `readToken` as the fifth
argument:

```ts
const state = new ClaudeQuotaState(
  fetcher,
  () => now,
  1000,
  500,
  () => "test-token",
);
```

Then append these three tests inside the existing `describe("claude quota")`
block:

```ts
it("resolves the token once and reuses it while polls succeed", async () => {
  vi.useFakeTimers();
  const readToken = vi.fn(() => "memo-token");
  const fetcher = vi.fn(async (token: string) =>
    token === "memo-token" ? 10 : undefined,
  );
  const state = new ClaudeQuotaState(fetcher, () => 0, 1000, 500, readToken);
  state.startPolling();
  await vi.advanceTimersByTimeAsync(0);
  expect(readToken).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(3000);
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(readToken).toHaveBeenCalledTimes(1);
  state.stopPolling();
  vi.useRealTimers();
});

it("re-resolves the token after a poll yields no value", async () => {
  vi.useFakeTimers();
  const readToken = vi.fn(() => "memo-token");
  let unusable = true;
  const fetcher = vi.fn(async () => (unusable ? undefined : 20));
  const state = new ClaudeQuotaState(fetcher, () => 0, 1000, 500, readToken);
  state.startPolling();
  await vi.advanceTimersByTimeAsync(0);
  expect(readToken).toHaveBeenCalledTimes(1);
  unusable = false;
  await vi.advanceTimersByTimeAsync(1000);
  expect(readToken).toHaveBeenCalledTimes(2);
  await vi.waitFor(() => expect(state.usedPercent).toBe(20));
  state.stopPolling();
  vi.useRealTimers();
});

it("skips the request entirely when no token can be resolved", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(async () => 5);
  const state = new ClaudeQuotaState(
    fetcher,
    () => 0,
    1000,
    500,
    () => undefined,
  );
  state.startPolling();
  await vi.advanceTimersByTimeAsync(2000);
  expect(fetcher).not.toHaveBeenCalled();
  state.stopPolling();
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/claude-quota.test.ts`

Expected: 3 failed, 9 passed. The failures are:

- `resolves the token once and reuses it while polls succeed`:
  `expected "spy" to be called 1 times, but got 0 times` for `readToken`. Today
  `pollOnce` calls `this.fetcher()` with no token at all, so `readToken` is
  never consulted.
- `re-resolves the token after a poll yields no value`: same cause.
- `skips the request entirely when no token can be resolved`: `fetcher` was
  called, which the assertion forbids.

The pre-existing test edited in step 1 still passes at this point, because the
current four-parameter constructor silently ignores the extra fifth argument.

- [ ] **Step 3: Split the HTTP request out of `fetchClaudeUsedPercent`**

In `src/claude-quota.ts`, replace the entire current
`export async function fetchClaudeUsedPercent(...) { ... }` block with these two
functions. `requestClaudeUsage` is deliberately **not** exported.

```ts
async function requestClaudeUsage(
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<number | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchFn(CLAUDE_USAGE_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "anthropic-beta": "oauth-2025-04-20",
      },
      signal: controller.signal,
    });
    if (!response.ok) return undefined;
    return parseSpendPercent(await response.json());
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchClaudeUsedPercent(
  fetchFn: typeof fetch = fetch,
  readPiAuth?: () => string | undefined,
  readKeychain?: () => string | undefined,
  credentialsPath?: string,
): Promise<number | undefined> {
  const token = readClaudeAccessToken(
    readPiAuth,
    readKeychain,
    credentialsPath,
  );
  if (!token) return undefined;
  return requestClaudeUsage(token, fetchFn);
}
```

This keeps `fetchClaudeUsedPercent`'s signature and behaviour byte-identical, so
its three existing tests keep passing untouched.

- [ ] **Step 4: Add the memo to `ClaudeQuotaState`**

Three edits in the `ClaudeQuotaState` class.

Add the field and change the constructor:

```ts
export class ClaudeQuotaState {
  private value: number | undefined;
  private token: string | undefined;
  private updatedAt = 0;
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private inFlight = false;

  constructor(
    private readonly fetcher: (token: string) => Promise<number | undefined> = (
      token,
    ) => requestClaudeUsage(token),
    private readonly now: () => number = Date.now,
    private readonly pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    private readonly staleTtlMs = DEFAULT_STALE_TTL_MS,
    private readonly readToken: () => string | undefined = () => readClaudeAccessToken(),
  ) {}
```

Replace `pollOnce` with the memoized version:

```ts
  private async pollOnce(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const token = this.token ?? this.readToken();
      if (!token) return;
      const next = await this.fetcher(token);
      if (next === undefined) {
        // A failed poll may mean the memoized credential has gone stale, so drop it and
        // re-resolve from auth.json, the keychain, or the credentials file next time.
        this.token = undefined;
        return;
      }
      this.token = token;
      this.value = next;
      this.updatedAt = this.now();
    } finally {
      this.inFlight = false;
    }
  }
```

Leave `startPolling`, `stopPolling`, `isPolling`, and `usedPercent` untouched in
this task. Task 2 changes `startPolling`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/claude-quota.test.ts`

Expected: `Tests 12 passed (12)`.

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test`

Expected: `Test Files 14 passed (14)` / `Tests 95 passed (95)`.

```bash
git add src/claude-quota.ts src/claude-quota.test.ts
git commit -m "fix: memoize the Claude access token across quota polls"
```

## Task 2: Repaint the footer when a Claude poll completes

**Files:**

- Modify: `src/index.ts` (the `claude-quota` section check and the polling
  start)
- Modify: `src/claude-quota.ts` (`startPolling` and `pollOnce`)
- Test: `src/index.test.ts`, `src/claude-quota.test.ts`

**Interfaces:**

- Consumes from Task 1: the five-parameter `ClaudeQuotaState` constructor, with
  `readToken` last.
- Produces: `ClaudeQuotaState.startPolling(onComplete?: () => void): void`,
  matching `CodexQuotaState.startPolling`'s shape. `onComplete` fires in a
  `finally` block, so it runs on every poll attempt including failures and the
  no-token early return.

- [ ] **Step 1: Write the failing tests**

In `src/claude-quota.test.ts`, append:

```ts
it("invokes the completion callback after every poll, even without a value", async () => {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  const state = new ClaudeQuotaState(
    async () => undefined,
    () => 0,
    1000,
    500,
    () => "test-token",
  );
  state.startPolling(onComplete);
  await vi.advanceTimersByTimeAsync(2000);
  expect(onComplete).toHaveBeenCalledTimes(3);
  state.stopPolling();
  vi.useRealTimers();
});
```

In `src/index.test.ts`, first stop the real Claude state from being built. Every
call of the form `extension(pi, mockQuotaState);` must become
`extension(pi, mockQuotaState, mockQuotaState);` (5 occurrences). The second
argument is the Codex factory, the third is the Claude factory:

```bash
sed -i '' 's/extension(pi, mockQuotaState);/extension(pi, mockQuotaState, mockQuotaState);/g' src/index.test.ts
```

Then add the missing Claude factory to the two tests that pass factories
explicitly:

- In `"does not perform quota requests in lifecycle tests"`, add
  `mockQuotaState,` as the third argument of the `extension(...)` call, after
  the closing `) as any,`.
- In `"rerenders when Codex quota polling completes"`, change
  `extension(pi, () => quotaState);` to
  `extension(pi, () => quotaState, mockQuotaState);`.

Finally add the Claude counterpart test, immediately after the Codex
`"rerenders when Codex quota polling completes"` test:

```ts
it("rerenders when Claude quota polling completes", async () => {
  const pi = createMockPi();
  const claudeQuotaState = mockQuotaState();
  extension(pi, mockQuotaState, () => claudeQuotaState);
  const requestRender = vi.fn();
  const ctx = {
    hasUI: true,
    cwd: "/repo",
    getContextUsage: vi.fn(() => undefined),
    sessionManager: { getBranch: vi.fn(() => []) },
    ui: {
      setFooter: vi.fn((factory) => factory({ requestRender }, {}, {})),
    },
  };

  await pi.handlers.session_start[0]({}, ctx);

  const onComplete = claudeQuotaState.startPolling.mock.calls[0][0];
  expect(onComplete).toEqual(expect.any(Function));
  onComplete();
  expect(requestRender).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`

Expected: 2 failed, 95 passed.

- `invokes the completion callback after every poll, even without a value`:
  `onComplete` is never called, because `startPolling` ignores its argument
  today.
- `rerenders when Claude quota polling completes`: the callback read out of
  `claudeQuotaState.startPolling.mock.calls[0][0]` is `undefined`, because
  `src/index.ts:42` calls `startPolling()` with no arguments today, so there is
  nothing to hand back.

- [ ] **Step 3: Add the callback to `ClaudeQuotaState`**

In `src/claude-quota.ts`, replace `startPolling`:

```ts
  startPolling(onComplete: () => void = () => {}): void {
    if (this.intervalId) return;
    void this.pollOnce(onComplete);
    this.intervalId = setInterval(() => void this.pollOnce(onComplete), this.pollIntervalMs);
  }
```

Change `pollOnce`'s signature and its `finally` block. This mirrors
`src/codex-quota.ts:114-135` exactly:

```ts
  private async pollOnce(onComplete: () => void): Promise<void> {
```

```ts
    } finally {
      this.inFlight = false;
      onComplete();
    }
  }
```

- [ ] **Step 4: Wire the callback up in `src/index.ts`**

Two edits. Remove the premature start from the section check so both quota
states start after the footer factory is registered:

```ts
if (config.sections.includes("claude-quota")) {
  claudeQuotaState = createClaudeQuotaState();
}
```

Then start it alongside Codex:

```ts
codexQuotaState?.startPolling(requestFooterRender);
claudeQuotaState?.startPolling(requestFooterRender);
```

`requestFooterRender` is assigned inside the `ctx.ui.setFooter` factory, which
runs synchronously, so it holds the real renderer by the time either
`startPolling` call evaluates. The Codex path already relies on this.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`

Expected: `Test Files 14 passed (14)` / `Tests 97 passed (97)`.

- [ ] **Step 6: Verify the suite no longer spawns the keychain binary**

This is the acceptance check for Finding 4, and it must report `0`. It is
darwin-specific; on other platforms `readKeychainCredentials` returns early and
the count is trivially 0.

```bash
mkdir -p /tmp/shim
printf '#!/bin/sh\necho "CALLED: $*" >> /tmp/shim/calls.log\nexit 1\n' > /tmp/shim/security
chmod +x /tmp/shim/security
rm -f /tmp/shim/calls.log
PATH=/tmp/shim:$PATH npm test >/dev/null 2>&1
echo "keychain spawns: $(wc -l </tmp/shim/calls.log 2>/dev/null | tr -d ' ' || echo 0)"
rm -rf /tmp/shim
```

Expected: `keychain spawns: 0`. Before this task the same command reports `5`.

Note: the shim exits 1, so it stands in for a keychain without the Claude Code
item, which is the case this was measured against.

- [ ] **Step 7: Commit**

```bash
git add src/index.ts src/index.test.ts src/claude-quota.ts src/claude-quota.test.ts
git commit -m "fix: rerender the statusbar when Claude quota polling completes

ClaudeQuotaState.startPolling now takes the same onComplete callback
CodexQuotaState already had, so a value fetched between renders is
displayed instead of waiting for an unrelated render trigger.

index.test.ts was starting a real ClaudeQuotaState, so the suite spawned
security once per session_start and would have made live requests to
api.anthropic.com on a machine with Claude Code credentials in its
keychain. Both quota factories are now injected."
```

## Task 3: Pin the deliberate skip of api_key credentials

**Files:**

- Modify: `src/claude-quota.ts` (comment above `extractPiAuthToken`)
- Test: `src/claude-quota.test.ts`

**Interfaces:**

- Consumes: nothing. No behaviour changes, so no interface changes.
- Produces: nothing consumed by another task.

This task is a characterization test, not a red-first test. The behaviour it
asserts already exists, so **it passes immediately**. That is intentional and
expected: the test exists to fail if someone later widens the lookup to accept
`anthropic.key`, and the comment exists so the current skip does not read like
an oversight. Do not seek a failing run for it.

- [ ] **Step 1: Add the comment**

In `src/claude-quota.ts`, directly above
`function extractPiAuthToken(raw: string): string | undefined {`:

```ts
// Pi stores OAuth credentials as { type: "oauth", access, refresh } and API keys as
// { type: "api_key", key }. Only the OAuth access token is read here: the usage endpoint
// is OAuth-only, so an API key would be rejected as a Bearer token. An api_key-shaped
// entry therefore falls through to the keychain and the credentials file on purpose.
```

- [ ] **Step 2: Add the characterizing test**

In `src/claude-quota.test.ts`, immediately after
`"returns undefined when no source has a usable token"`:

```ts
it("ignores an api_key-shaped anthropic entry because the usage endpoint is OAuth-only", () => {
  const path = credentialsFile({
    claudeAiOauth: { accessToken: "file-token" },
  });
  const readPiAuth = () =>
    JSON.stringify({ anthropic: { type: "api_key", key: "sk-ant-not-oauth" } });
  const readKeychain = () =>
    JSON.stringify({ claudeAiOauth: { accessToken: "keychain-token" } });

  expect(readClaudeAccessToken(readPiAuth, readKeychain, path)).toBe(
    "keychain-token",
  );
  expect(readClaudeAccessToken(readPiAuth, noKeychain, path)).toBe(
    "file-token",
  );
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/claude-quota.test.ts`

Expected: `Tests 14 passed (14)`. This test passes on the first run, as
described above.

- [ ] **Step 4: Run the full suite and commit**

Run: `npm test`

Expected: `Test Files 14 passed (14)` / `Tests 98 passed (98)`.

```bash
git add src/claude-quota.ts src/claude-quota.test.ts
git commit -m "test: pin the deliberate skip of api_key anthropic entries"
```

## Final delivery

- [ ] **Step 1: Confirm the full suite and the keychain check one more time**

```bash
npm test
```

Expected: 14 files / 98 tests passing.

Re-run Task 2, step 6's shim check. Expected: `keychain spawns: 0`.

- [ ] **Step 2: Confirm the diff is scoped**

```bash
git diff --stat main
```

Expected: exactly four files, `src/claude-quota.ts`, `src/claude-quota.test.ts`,
`src/index.ts`, `src/index.test.ts`. Roughly +145 / -23. If `package-lock.json`
or anything under `docs/` appears, decide deliberately whether it belongs in
this PR.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin fix/claude-quota-credential-lifecycle
```

Open the PR against `main` titled
`fix: stop re-reading the keychain on every Claude quota poll`. The body must
cover:

- The four findings from the spec, and which commit addresses each.
- The deviation from CONTRIBUTING.md's one-change-per-PR rule, since the three
  fixes ship as one PR of three commits.
- That the Task 3 test is a characterization test which passes immediately.
- That the `security` spawn count went from 5 to 0 in the test suite, and how
  that was measured.

Do not tick CONTRIBUTING.md's "New features include test coverage" box without
noting that the Finding 3 test guards existing behaviour rather than new
behaviour.

## Self-review

Coverage of the spec's four findings:

| Finding                    | Task | Commit message                                     |
| -------------------------- | ---- | -------------------------------------------------- |
| 1: token re-resolved       | 1    | `fix: memoize the Claude access token...`          |
| 2: footer not repainted    | 2    | `fix: rerender the statusbar when Claude quota...` |
| 3: `anthropic.access` only | 3    | `test: pin the deliberate skip of api_key...`      |
| 4: real keychain I/O       | 2    | folded into commit 2, per the spec's decision 3    |

Spec non-goals are all untouched: no token refresh, no interval or TTL changes,
no on-disk cache, no `codex-quota.ts` edits, no lint or format config.

Verified while writing this plan, so the expected counts above are measured
rather than predicted:

- Baseline on `main` at `6252037`: 92 tests, 14 files, green.
- All three tasks applied together: 98 tests, 14 files, green.
- `security` spawns: 5 at baseline, 0 after Task 2. Every one of the 5 came from
  `src/index.test.ts`; `src/claude-quota.test.ts` contributes 0.

Known traps this plan routes around:

- Adding `readToken` as the second constructor parameter breaks
  `src/claude-quota.test.ts`, which constructs the class positionally. Append
  it.
- The pre-existing `"prevents overlap, expires stale values, and cleans up"`
  test fails the moment `readToken` exists but is not stubbed, because the
  default reads the real keychain. Step 1 of Task 1 stubs it before the
  implementation lands.
- `startPolling` must keep its optional-parameter form. `src/index.ts` is the
  only caller that passes a callback, and `claude-quota.test.ts` calls it bare
  in four places.
