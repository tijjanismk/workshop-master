# Code review - The Workshop Master

Date: 2026-09-12  
Scope: diagnostic orchestration, persistence, retrieval, and channel adapters.  
Validation run: `npm run typecheck` passed.

## Summary

The core diagnostic flow is well structured: a strict output contract, Zod validation, low-risk-test rules, and a safe provider fallback give the project a strong hackathon foundation. The main risks are state durability on Vercel and a few cases where the channel response can drift from the newest decision.

## Remediation status — 2026-09-12

- **Fixed:** stale next-test messages after resolution/escalation; channel responses now use the current decision instead of accumulated historical warnings; Telegram labels and generated power warnings are localized; Bambara (`bm`) is recognized; malformed JSON and slow Telegram calls are handled safely; web session recovery is structurally validated; Exa can retrieve additional evidence for a new technical query.
- **Requires deployment infrastructure:** durable Telegram memory across Vercel instances still needs a shared database. `/tmp` remains a hackathon/demo fallback and should not be presented as production persistence.
- **Still recommended:** rank or label Exa sources by manufacturer/official origin before using the application for safety-critical work.

## Findings

### [P1] Telegram session memory is not durable across Vercel instances

**Files:** `src/lib/diagnostics/session-store.ts:14-18,38-43,96-116`  
**Impact:** A Telegram chat can lose its diagnostic history when Vercel serves a later webhook from another serverless instance or after an instance is recycled. The `channel_session_map` and the session snapshot are both stored in `/tmp` on Vercel, which is ephemeral and instance-local.

The web dashboard has a partial continuity mechanism (`sessionSnapshot`), but Telegram has no equivalent because it only receives the chat ID and looks up the mapping in SQLite.

**Recommended fix:** Move `diagnostic_sessions` and `channel_session_map` to a shared persistent database before treating Telegram as production-ready. Postgres/Supabase/Neon are suitable choices. Keep SQLite only for local development.

### [P1] A completed or escalated diagnostic can still expose a stale “Next test”

**Files:** `src/lib/diagnostics/orchestrator.ts:374-396`; `src/lib/channels/format-response.ts:5-7`  
**Impact:** `applyDecision()` changes `session.currentTest` only when the new decision contains `nextTest`. If a decision resolves or escalates a case with no next test, the previous `currentTest` remains in the session. `formatChannelResponse()` then sends that old test again.

This is misleading for a technician and can conflict with an escalation decision.

**Recommended fix:** Explicitly clear `session.currentTest` when `decision.nextTest` is absent or when `status` is `resolved` / `escalated`. Format channels from the current `decision.nextTest`, not from the historical session field.

### [P1] The public API accepts an unvalidated client session snapshot as diagnostic truth

**Files:** `src/app/api/diagnostics/route.ts:20,46`; `src/lib/diagnostics/orchestrator.ts:405-411`  
**Impact:** `sessionSnapshot` is declared as `z.unknown()` and then cast to `DiagnosticSession`. When server-side lookup misses, the server accepts that snapshot if its `id` matches `sessionId`. A client can forge observations, hypotheses, sources, tests, or a status and make them part of the server-side session.

**Recommended fix:** Validate the complete snapshot with a Zod schema and accept it only as a narrowly scoped recovery mechanism. Better: persist the session in a shared database and remove client snapshot recovery. Add user/session authorization before exposing this endpoint beyond the demo.

### [P2] Telegram can show an old safety warning and mixes French with English

**Files:** `src/lib/channels/format-response.ts:8-10`; `src/lib/diagnostics/orchestrator.ts:374-377`  
**Impact:** The formatter uses `result.session.safetyWarnings.at(-1)`, which is accumulated history, not necessarily the warning for the current action. In addition, the power-off warning injected by the orchestrator is hard-coded in English. A real French Telegram test therefore produced a French response followed by `Safety: Turn off and unplug the machine before this test.`

**Recommended fix:** Format `result.decision.safetyWarnings` for the current turn only. Localize platform-generated warnings using the selected language and use the same response labels (`Prochain test`, `Sécurité`) as the message language.

### [P2] Bambara is not selected automatically for Telegram users

**Files:** `src/app/api/channels/telegram/route.ts:21-26,102`  
**Impact:** Telegram language mapping only recognizes French and Chinese; every other locale falls back to English. A Telegram user whose locale is `bm` will receive an English model instruction, even though the web app exposes Bambara as experimental.

**Recommended fix:** Add `if (language.startsWith("bm")) return "bm";`. Keep the product disclosure that Bambara output is experimental and fall back to simple French when terminology is uncertain.

### [P2] Technical retrieval stops permanently after the first successful search

**Files:** `src/lib/retrieval/exa.ts:24-29`; `src/lib/diagnostics/orchestrator.ts:426-428`  
**Impact:** Once `retrievedSources` is non-empty, Exa never runs again for that session. A technician can later provide a new error code, component, or a more exact model, but the agent will continue relying on old sources.

**Recommended fix:** Store retrieval queries or a retrieval fingerprint. Trigger a new search when a new model, error code, or component is introduced; retain older sources with provenance instead of overwriting the whole list.

### [P2] Exa source quality is not enforced

**Files:** `src/lib/retrieval/exa.ts:31-57`  
**Impact:** The query asks for official documentation, but results are not restricted to manufacturer domains and no source-quality score is checked. A forum or low-quality result can be shown as technical evidence.

**Recommended fix:** Prefer an allowlist of manufacturer support/documentation domains when a manufacturer is known. Display source origin and distinguish official manuals from community guidance.

### [P3] Channel adapters do not consistently handle malformed JSON or outbound timeouts

**Files:** `src/app/api/channels/telegram/route.ts:57-65,79`; `src/app/api/channels/whatsapp-simulator/route.ts:14`  
**Impact:** Malformed Telegram/WhatsApp simulator request bodies can cause a 500 response. `sendTelegramMessage()` has no timeout, so a slow Telegram API can retain the serverless request longer than intended.

**Recommended fix:** Wrap `request.json()` in `try/catch` and return a controlled 400 response. Add `AbortSignal.timeout()` to the Telegram `sendMessage`, `getFile`, and download requests; log errors with request-safe metadata.

## Recommended order of work

1. Replace Vercel `/tmp` persistence with a shared database for all channels.
2. Clear stale `currentTest` and format Telegram output from the current decision.
3. Validate or remove browser-provided session snapshots.
4. Localize channel formatting and support `bm` explicitly as experimental.
5. Improve retrieval refresh and source trust rules.
6. Add automated tests for resolved/escalated flows, serverless session recovery, Telegram language selection, and malformed webhook payloads.

## Positive implementation notes

- The agent's JSON schema and Zod validation are a good defense against malformed model responses.
- The provider timeout and safe fallback avoid inventing unsafe physical steps when an AI provider fails.
- The prompt directly addresses repeated questions, low-literacy language, evidence separation, and risk-aware escalation.
- Image input has type checks and a size guard before model routing.
