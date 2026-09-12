# The Workshop Master — AI and Product Context

This document is the source of truth for product behavior, architecture, UX decisions, and implementation priorities. Update it whenever a product, provider, storage, retrieval, or interface decision changes.

## 1. Product mission

**The Workshop Master** is a multilingual, multimodal diagnostic mentor for technicians and apprentices: the master technician who is not in the room.

The first reference domain is printer/electronics troubleshooting. Garage and vehicle cases are supported as demos and retrieval scenarios. The product is not a generic chatbot. It guides a technician through a real loop:

```text
Observe → Understand → Hypothesize → Test → Evaluate → Next action
```

The output must be one specific, low-risk physical test or a clear escalation recommendation.

## 2. Hackathon scope and reference demo

The reliable reference workflow is an Epson L3210 that feeds paper, reaches the print area, sometimes reports a paper jam, and does not start printing:

```text
Text, photo, or browser voice input
→ persistent diagnostic session
→ structured facts, evidence, and hypotheses
→ one safe next test
→ technician result
→ updated state, resolution, or escalation
```

The diagnosis must never be hardcoded. Real Telegram text/photo interaction is supported. `/telegram-demo` and `/whatsapp-demo` are demonstration routes; the WhatsApp route is not an official Meta integration.

## 3. Product rules

- Treat every message as part of a diagnostic session, never as isolated chat.
- Keep technician observations, visual facts, external evidence, hypotheses, and general AI knowledge distinct.
- Treat the technician as competent. Do not lecture, restart generic intake, or ask again for a known fact.
- Answer direct technical questions first; then propose one test only if it helps.
- Separate a reported symptom from the likely underlying cause. Do not anchor on the first named component, forum post, or video.
- Keep competing hypotheses when evidence permits and choose the lowest-risk test with the highest ability to distinguish them.
- Never present a hypothesis as confirmed or invent an unseen fault.
- Give safety instructions only when relevant. Escalate instead of suggesting high-risk remote work.
- For a vague vehicle complaint, ask for the symptom category before proposing an action. Never ask the user to start, rev, or drive the vehicle just to begin diagnosis.
- For brakes/steering, smoke, fuel smell or leak, severe overheating, or a red warning light: tell the user not to start or drive, then triage the immediate risk.
- Never expose, log, commit, or send server secrets to a client/channel.

## 4. Current architecture

```text
Web Diagnostic Workspace / Telegram / WhatsApp simulator
                         ↓
                  Input gateway
                         ↓
             POST /api/diagnostics
                         ↓
              Session orchestrator
                 ↙              ↘
   Supabase session store       Provider router
   SQLite local fallback        DeepSeek → OpenRouter → safe fallback
                         ↓
         Structured Zod decision validation
                         ↓
              AI quality-review pass
                         ↓
  Exa evidence routine + safety/state updater
                         ↓
            Structured session and decision response
```

## 5. Runtime modules

| Module | Responsibility | Status |
| --- | --- | --- |
| `src/lib/diagnostics/types.ts` | Session, test, source, and decision contracts | Implemented |
| `src/lib/diagnostics/session-store.ts` | Supabase persistence with SQLite local fallback | Implemented |
| `src/lib/diagnostics/orchestrator.ts` | Provider routing, validation, self-review, source policy, safety, state updates | Implemented |
| `src/lib/retrieval/exa.ts` | Manufacturer/community/video evidence retrieval and classification | Implemented |
| `src/app/api/diagnostics/route.ts` | Web API input and session-snapshot validation | Implemented |
| `src/app/api/channels/telegram/route.ts` | Telegram webhook for text/photos, secret verification, timeouts | Implemented |
| `src/app/api/channels/whatsapp-simulator/route.ts` | Demo adapter using the shared diagnostic engine | Implemented |
| `src/components/workshop-dashboard.tsx` | shadcn/ui Diagnostic Workspace with text/photo/browser-voice controls and evidence timeline | Implemented |
| `src/components/ui/*` | Local shadcn/ui Button, Card, Badge, Alert, and Textarea primitives | Implemented |
| Browser speech input/output | Dictation and read-aloud where the browser supports it | Implemented; browser dependent |
| Voice-note transcription | Telegram/WhatsApp audio transcription to session text | Planned |
| Official WhatsApp Cloud adapter | Meta webhook and media integration | Planned |

## 6. Session and persistence model

Each `DiagnosticSession` contains:

```text
Machine: manufacturer, model, type
Symptoms and observations (technician, agent, vision)
Hypotheses
Completed tests and optional current test
Retrieved sources: title, URL, source type, query, highlights
Safety warnings
Status: active, resolved, escalated
```

When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured, server-side sessions and Telegram chat mappings use these Supabase tables:

```text
diagnostic_sessions
channel_session_map
```

RLS is enabled and no public policy exposes these tables. The server service-role key is the only access path. SQLite at `data/workshop-master.sqlite` is retained for local development. On Vercel, `/tmp` SQLite is an emergency/demo fallback only and is not durable across serverless instances.

The web client sends a structurally validated snapshot only as a Vercel continuity fallback; shared Supabase storage is the production path.

## 7. Agent decision and quality control

Every model turn returns a validated structured decision:

```text
assistantMessage
machine
observations[]
visualObservations[]
hypotheses[]
nextTest | null
safetyWarnings[]
status
```

`nextTest` includes title, instruction, purpose, risk, and power-off requirement. High-risk actions are changed to escalation. A resolved, escalated, or no-next-test decision clears `currentTest`, preventing channels from resending a stale physical instruction.

The first response is checked with Zod. Then, unless `DIAGNOSTIC_SELF_REVIEW=false`, the selected AI provider performs a second structured review. It corrects repeated questions, unsupported claims, ignored direct questions, unsafe/incoherent tests, and mismatched status/safety. If this review fails, the already validated first decision is kept so diagnostics do not block.

The expected latency is intentional and communicated in the interface as:

> L’IA réfléchit : contexte, sources et sécurité…

## 8. Provider routing

```text
DeepSeek configured?
  Yes → DeepSeek Responses API
  Failure or no key → OpenRouter if configured
  Neither available → safe deterministic fallback
```

Environment variables:

```env
DEEPSEEK_API_KEY=
DEEPSEEK_TEXT_MODEL=deepseek-v4-flash
DEEPSEEK_VISION_MODEL=deepseek-v4-flash-vision-exp

OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free

EXA_API_KEY=
DIAGNOSTIC_SELF_REVIEW=true

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```

Use the text model for technician messages and a vision model only when an image is attached. OpenRouter is a fallback, not a parallel second opinion.

## 9. Evidence and retrieval routine

For a new relevant technical identifier (brand, model, error code, OBD code), Exa runs a bounded three-part routine in parallel:

```text
1. Current session context and technician observations
2. Manufacturer service manuals/support documentation (preferred)
3. Technician forums/community discussions (lead, not proof)
4. YouTube/video demonstrations (lead, not proof)
5. General model knowledge (hypothesis only, never external evidence)
```

Each result is kept with a URL, original query, highlights, and source type:

```text
manufacturer | community | video | web
```

Source labels are checked from result domains where possible. The agent must prefer manufacturer evidence. Community/video claims require a safe confirmation test; model training must never be presented as a manufacturer document, forum post, or proof.

## 10. Frontend architecture and UX decision

The frontend is Next.js App Router, React 19, Tailwind CSS 4, and **shadcn/ui**. HeroUI has been removed by explicit product decision; do not reintroduce it. Local shadcn primitives live in `src/components/ui` and are styled with the project’s industrial dark theme.

```text
src/app/page.tsx
  → WorkshopDashboard
      → /api/diagnostics
      → structured session and decision
```

The primary screen is the **Diagnostic Workspace**, not a chatbot or accounting-style dashboard. It must answer immediately:

> What does the technician need to do next?

Design direction:

- Serious industrial-tech tool: deep navy/slate surfaces, electric blue for action, amber only for attention/safety.
- No generic chatbot identity, cartoon robots, excessive gradients, or decorative animation.
- Mobile workshop-floor use is first-class: touch-friendly actions, readable contrast, clear labels, and a layout that does not merely shrink desktop.
- Bambara is experimental. French, English, Simplified Chinese, and Bambara remain accessible in the language control.

Next UX refactor priority, without replacing the real API flow:

1. Machine/session header with elapsed session time and relevant safety state.
2. Further mobile action-bar refinement.
3. Timeline support for image and voice event cards.
4. Compact technical-source panel with expandable highlights.

## 11. Entry points

Web API:

```text
POST /api/diagnostics
```

First message:

```json
{
  "message": "The printer feeds paper but reports a paper jam before printing.",
  "language": "fr"
}
```

Later message:

```json
{
  "sessionId": "the-session-uuid",
  "message": "The sensor lever returns freely.",
  "language": "fr"
}
```

The response contains the updated `session`, the decision, and the selected provider.

## 12. Implementation priorities

1. Diagnostic core, Supabase persistence, provider fallback, safety, and self-review — complete.
2. Text/photo/browser-voice workspace and multilingual UI — complete.
3. Telegram text/photo integration — complete; requires Vercel production variables for durable cloud use.
4. Evidence retrieval: manufacturer, community, video, and context — complete.
5. Epson L3210 end-to-end demo and real Telegram test — complete.
6. shadcn/ui Diagnostic Workspace refactor — complete.
7. Audio “Shazam-style” prototype for vehicles/machines — planned. Sound similarity is a lead, never a confirmed diagnosis.
8. Voice-note transcription, community evidence with consent, and offline-friendly flow — planned.
9. Official WhatsApp Cloud API adapter — planned; requires Meta configuration and HTTPS webhook.

## 13. Definition of done

A judge or technician can see that the product accepts evidence, remembers it, searches and labels relevant sources, updates hypotheses, selects one safe next action, and progresses to resolution or escalation without acting like a generic chat bot.

## 14. Change log

- Added HeroUI workspace with diagnostic state, text/photo input, browser voice controls, safety, hypotheses, observations, and sources.
- Added French, English, Simplified Chinese, and experimental Bambara UI and agent instructions.
- Added image validation and DeepSeek vision routing; only visible facts are stored as vision observations.
- Added Telegram text/photo webhook, optional webhook secret, language mapping, outbound timeouts, and malformed-JSON handling.
- Added WhatsApp-style in-app demo and dedicated Telegram demo route.
- Added Supabase tables and server-side store adapter, with SQLite local fallback.
- Added strict browser snapshot validation for stateless Vercel recovery.
- Fixed stale next-test channel messages and localized current-turn safety formatting.
- Added DeepSeek/OpenRouter structured self-review with a safe fallback to the first validated decision.
- Added technician-respect, no-repeat, direct-answer, root-cause, and competing-hypothesis rules.
- Added deterministic vehicle triage for vague or urgent automotive complaints before model routing; it prevents unsafe start/drive suggestions and screens critical warning signs.
- Added Exa manufacturer/community/video retrieval routine and evidence-source classification.
- Added the transparent processing message explaining that the AI is reviewing context, sources, and safety.
- Replaced HeroUI with local shadcn/ui primitives and rebuilt the main workspace and Telegram demo without HeroUI imports.
