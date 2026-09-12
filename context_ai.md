# The Workshop Master — AI Context

This document is the source of truth for the product, agent behavior, technical architecture, and implementation priorities.

## 1. Product mission

The Workshop Master is a multimodal diagnostic assistant for apprentices and maintenance technicians.

The first domain is printer and electronics troubleshooting. The product is not a generic chatbot. It must guide a technician through a real diagnostic loop:

```text
Observe → Understand → Hypothesize → Test → Evaluate → Next action
```

The result must be a specific, safe physical test or a clear escalation recommendation.

## 2. Hackathon scope

The demo must reliably show one printer troubleshooting workflow:

```text
Technician message or photo
→ Persistent diagnostic session
→ Structured facts and hypotheses
→ One safe next test
→ Technician result
→ Updated diagnostic state
→ Next test or escalation
```

The first reference case is an Epson L3210 that feeds paper, reaches the print area, sometimes reports a paper jam, and does not start printing. The diagnosis must never be hardcoded.

## 3. Product rules

- Treat each incoming message as part of a diagnostic session, not as an isolated chat.
- Keep facts, technician statements, retrieved evidence, and hypotheses separate.
- Never present a hypothesis as a confirmed diagnosis.
- Ask for one test at a time.
- Prefer the lowest-risk test with the highest information value.
- Do not ask a technician to manipulate a machine before giving required safety instructions.
- Escalate instead of suggesting a high-risk remote operation.
- Never expose API keys to the client or commit them to Git.

## 4. Architecture

```text
Workshop dashboard / future WhatsApp adapter
                ↓
         Input gateway
                ↓
     POST /api/diagnostics
                ↓
      Session orchestrator
          ↙            ↘
 SQLite session store   AI provider router
                         ↙          ↘
                   DeepSeek      OpenRouter fallback
                         ↓
                  Decision validator
                         ↓
            Safety guard and state updater
                         ↓
                 Structured response
```

## 5. Current modules

| Module | Responsibility | Status |
| --- | --- | --- |
| `src/lib/diagnostics/types.ts` | Diagnostic session and decision contracts | Implemented |
| `src/lib/diagnostics/session-store.ts` | Local SQLite persistence | Implemented |
| `src/lib/diagnostics/orchestrator.ts` | Provider routing, decision validation, safety rules, state updates | Implemented |
| `src/app/api/diagnostics/route.ts` | HTTP entry point and input validation | Implemented |
| `src/components/workshop-dashboard.tsx` | Display the active diagnostic state and collect text input | Implemented |
| Browser voice controls | Speech-to-text input and text-to-speech response in the dashboard | Implemented, browser-dependent |
| `src/app/api/channels/telegram/route.ts` | Secure Telegram webhook for text and photos | Implemented, requires configuration |
| Image processing | Validate an inspection photo and send it to the vision model | Implemented |
| Voice processing | Transcribe voice messages into the same session context | Planned |
| `src/lib/retrieval/exa.ts` | Retrieve targeted technical evidence | Implemented |
| WhatsApp adapter | Forward WhatsApp media and replies to the input gateway | Planned |

## 6. Diagnostic session

Every session stores:

```text
Machine information
Symptoms
Observations
Hypotheses
Completed and current tests
Safety warnings
Status: active, resolved, or escalated
```

The SQLite database is local for the hackathon prototype. The application creates it at `data/workshop-master.sqlite` when the first session is saved.

## 7. Agent decision contract

For each technician turn, the model returns a validated structured decision:

```text
assistantMessage
machine
observations[]
hypotheses[]
nextTest | null
safetyWarnings[]
status
```

`nextTest` contains a title, instruction, purpose, risk level, and whether the machine must be powered off. High-risk tests are blocked by the application and changed to an escalation.

## 8. Provider routing

```text
DeepSeek key available?
  Yes → DeepSeek Responses API
  No or request fails → OpenRouter, only when its key is configured
  Neither available → Safe deterministic fallback
```

Environment variables:

```env
DEEPSEEK_API_KEY=
DEEPSEEK_TEXT_MODEL=deepseek-v4-flash
DEEPSEEK_VISION_MODEL=deepseek-v4-flash-vision-exp

OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free

EXA_API_KEY=
```

Use the text model for technician messages. Use the vision model only when an image is actually attached. OpenRouter is a low-volume fallback, not a second parallel opinion.

## 9. Retrieval orchestration

Exa is called only when the next decision needs technical evidence, for example:

- a machine model or error code is known;
- a hypothesis needs confirmation from a service manual;
- a component or sensor behavior is unclear.

```text
Diagnostic context
→ Focused search query
→ Exa results
→ Relevant technical evidence
→ Agent decision
```

Retrieved information must include a source URL and must be labeled as external evidence in the session.

## 10. Entry point

The current entry point is:

```text
POST /api/diagnostics
```

First message:

```json
{
  "message": "The printer feeds paper but reports a paper jam before printing."
}
```

Later message in the same session:

```json
{
  "sessionId": "the-session-uuid",
  "message": "The sensor lever returns freely."
}
```

The response contains the updated session, the decision, and the selected provider.

## 11. Implementation order

1. Diagnostic core and persistence — complete.
2. Workshop dashboard for text interaction and visible state — complete.
3. Image upload and DeepSeek vision routing — complete.
4. Exa technical retrieval with source references — complete.
5. Browser voice input and output — complete for supported browsers; Bambara remains experimental.
6. End-to-end Epson L3210 demonstration.
7. Telegram webhook for text and photos — complete, requires a bot token and public HTTPS URL.
8. WhatsApp Cloud API adapter — planned, requires Meta configuration and a public HTTPS URL.

## 12. Definition of done

A judge must see that the product receives technician evidence, remembers previous evidence, updates hypotheses, requests a concrete test, and progresses toward a diagnosis or safe escalation.

The product should make it obvious that it is a workshop agent, not a generic chatbot.

## 13. Change log

- Added a workshop-first text dashboard with the current test, hypotheses, safety warnings, recent observations, and provider status.
- The browser stores only the diagnostic session ID in local storage. The diagnostic history remains in the server-side SQLite session store.
- Added image validation (JPEG, PNG, WebP, or GIF; maximum 5 MB) and DeepSeek vision routing. Visible facts from the model are stored as `vision` observations.
- Added targeted Exa retrieval for first-turn messages containing a manufacturer, model, or error identifier. Sources are saved in the session and visible in the dashboard.
- Added structured machine extraction. The agent can now populate the dashboard’s manufacturer, model, and machine type from explicit technician evidence.
- Added a dashboard action to reset the browser’s active session and begin a fresh demo without deleting stored server-side history.
- Added `demo_runbook.md` with the presentation sequence and a recovery plan for provider or retrieval outages.
- Added language selection (French, English, and experimental Bambara) to guide model responses, browser dictation, and browser speech output.
- Added a Telegram adapter that maps each chat to one persisted diagnostic session, accepts text or photos, and replies with the next diagnostic action.
- Added Simplified Chinese (`zh`) end to end: dashboard labels, browser voice locale, API validation, agent response instruction, safe fallback, and Telegram language detection. The dashboard labels are now translated for French, English, Simplified Chinese, and experimental Bambara.
- Restyled the dashboard with HeroUI v3 components (cards, buttons, chips, text input, and loading feedback) while preserving the diagnostic workflow.
- Strengthened the diagnostic prompt to prevent repeated intake questions and compacted the model context (recent facts, current test, and bounded source highlights) to keep later turns responsive after retrieval.
- Added an accessible-language rule: short spoken-style messages, one observation per turn, and no unexplained jargon. The demo now includes simple Epson and garage scenarios; Exa retrieval recognizes common vehicle brands and OBD P0xxx codes.
- Added a 12-second per-provider timeout with no automatic retries. Slow providers now fall back safely instead of leaving technicians waiting indefinitely.
- Added `/whatsapp-demo`: a WhatsApp-style, in-app simulator using the same diagnostic engine and persistent session. It is explicitly a demo, not a live WhatsApp Business integration.
