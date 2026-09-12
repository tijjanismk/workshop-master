# Product roadmap — The Workshop Master

## Implemented features

These features are available in the current prototype and are the foundation for the roadmap below.

### Guided diagnostic agent

- One physical check at a time, with low-risk-first guidance.
- Strict structured AI output validated with Zod before it becomes a diagnostic decision.
- Second AI quality-review pass before sending a response: it checks context use, repetition, unsupported claims, direct-question handling, and next-test/safety consistency.
- Full session context: machine identity, observations, prior tests, hypotheses, technical sources, and safety history.
- Protection against repetitive intake questions; the latest technician message is treated as the result of the current test when appropriate.
- Root-cause orientation: separates the reported symptom from competing underlying causes and chooses tests that distinguish between them instead of anchoring on the first suspected part.
- Safe fallback when DeepSeek or OpenRouter is unavailable: no invented diagnosis and no unsafe new operation.
- Resolution and escalation clear the active test, so a previous action is never sent again as the “next test.”

### Multilingual and accessible communication

- Web interface in French, English, Simplified Chinese, and experimental Bambara.
- Telegram selects French, Chinese, and Bambara (`bm`) from the Telegram language code when supplied.
- Short plain-language instructions designed for technicians with limited literacy.
- Browser speech input is available in the web dashboard where the device/browser supports it.
- Bambara remains experimental: when technical vocabulary is uncertain, the agent should use clear French instead of guessing.

### Image, evidence, and AI providers

- Text and image diagnostic requests, including visible error codes, nameplates, LEDs, and components.
- DeepSeek primary provider, optional OpenRouter fallback, and separate text/vision model configuration.
- Exa technical retrieval for manufacturer/model/error-code queries, with source links retained in the session.
- New technical identifiers can trigger additional retrieval instead of permanently reusing only the first search.
- Evidence routine runs parallel searches for manufacturer documents, clearly-labelled technician/community discussions, and YouTube/video demonstrations; source labels are verified from the result domain where possible.
- Session context is always considered first. General model knowledge is treated as an unverified hypothesis, never as an external source.

### Channels and demos

- Responsive HeroUI web dashboard.
- The interface explicitly shows that the AI is performing a deeper review of context, sources, and safety while it works.
- Real Telegram webhook adapter for text and photos, protected by an optional webhook secret.
- Telegram outbound calls have a timeout and controlled error handling; malformed updates return a safe 400 response.
- Local WhatsApp-style simulator for demonstrations. It is not an official WhatsApp Business integration.
- Dedicated `/telegram-demo` and `/whatsapp-demo` demo routes.

### Durable sessions and safety

- Supabase-backed diagnostic sessions and Telegram chat-to-session mapping when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured.
- SQLite fallback for local development only.
- Row Level Security is enabled on Supabase session tables; only the server-side service-role key accesses them.
- Channel messages show the current decision’s safety warning, localized with the response instead of replaying an old warning.
- High-risk remote operations are blocked and escalated.

## Product direction

The Workshop Master is becoming a multilingual, low-literacy maintenance copilot for workshops. The next major capability is **sound-assisted identification**: a technician records a short sound from a vehicle or machine, and the app proposes safe diagnostic paths based on acoustic patterns, the machine context, and verified technical evidence.

This is inspired by the ease of Shazam, not by the idea of making an autonomous repair decision. A sound match is a **lead** with an explicit confidence level. The technician and the guided low-risk checks remain in control.

## Priority features

### 1. Sound signature assistant (Cars, motorcycles, generators)

**User experience**

1. The technician selects the equipment type and records 10–20 seconds of sound.
2. The app checks recording quality: too quiet, wind noise, speech, clipping, or engine speed changes.
3. It extracts an acoustic fingerprint and compares it with a labeled sound library.
4. It returns up to three possible pattern families, such as belt squeal, wheel-bearing rumble, knocking, misfire, starter click, or generator vibration.
5. It asks for one low-risk confirmation: where the sound comes from, when it occurs, dashboard light, cold/hot engine, or a visual inspection.
6. It either proposes the next safe test or escalates to a mechanic.

**Safety rule**

Never tell a user to drive, rev, open a hot engine, touch moving belts, or bypass a safety system in order to capture a sound. High-risk patterns (brake grinding, fuel smell, severe knocking, overheating) must display an immediate stop/escalate instruction.

### 2. Equipment identity from photo + text

Use a photo of the nameplate, dashboard, printer panel, engine, or error code together with the spoken/text description. The output should extract only visible information: brand, model, code, light pattern, and component label. It must not claim that an unseen part is damaged.

### 3. Guided voice interaction

Allow a technician to send voice notes through the web app, Telegram, and future WhatsApp Business integration. The system should transcribe, confirm critical identifiers back to the user, and answer in short spoken-friendly sentences.

Language support order:

- French and English: full text and voice workflow.
- Bambara: experimental short replies, clear disclosure, French fallback for uncertain technical terms.
- Simplified Chinese: text workflow; voice after transcription quality testing.

### 4. Community evidence, with consent

Let verified workshops contribute anonymized repair cases: machine type, symptom, confirmed repair, non-sensitive photos, and optional sound clip. Every contribution must have consent, removal controls, and no personal contacts, number plates, VINs, faces, or exact location by default.

Community cases are supporting evidence only. Official manuals and manufacturer guidance remain visibly preferred when available.

### 5. Offline-friendly workshop mode

Support weak connections with queued text, compressed audio, local language prompts, and a downloadable pack of the most common decision trees. Sync when a connection returns.

## Technical architecture for sound-assisted diagnostics

```text
Voice note / microphone
        ↓
Client-side quality checks + consent
        ↓
Audio storage (private, time-limited) ──→ transcription (optional)
        ↓
Feature extraction / embedding
        ↓
Vector similarity search over labeled sound library
        ↓
Safety rules + machine context + verified documentation
        ↓
One low-risk next test, confidence, and escalation decision
```

### Recommended implementation phases

#### Phase A — Hackathon-quality prototype

- Add a microphone control to the web dashboard.
- Save a 10–20 second `webm` recording locally for the active session only.
- Add recording-quality checks and a mock labeled sound library.
- Use deterministic rules for 5–8 well-defined patterns; show “possible pattern,” never “confirmed fault.”
- Include a demo dataset with consent-cleared or synthetic recordings only.

#### Phase B — Validated pilot

- Build a consented dataset with local garages: vehicle/equipment context, clip conditions, confirmed diagnosis, and outcome.
- Store clips in private object storage with a retention policy.
- Generate audio embeddings on a server worker and index them in a vector database.
- Measure precision, false-positive rate, and performance by device, noise level, engine type, and language.
- Require a contextual confirmation question before any recommendation.

#### Phase C — Production service

- Use a shared database for users, diagnostic sessions, channel mappings, consent, and audit events.
- Add authenticated technician accounts and role-based access.
- Integrate official WhatsApp Business API after Meta approval; keep the current simulator clearly labeled as a demo.
- Add monitoring, rate limiting, deletion/export tools, and multilingual human review for unsafe or uncertain cases.

## Data model additions

```text
audio_clips
  id, diagnostic_session_id, consent_version, storage_key, duration_ms,
  quality_score, recorded_at, expires_at

sound_patterns
  id, equipment_type, label, severity, safe_summary,
  embedding_reference, verified_by, evidence_url

sound_matches
  id, audio_clip_id, sound_pattern_id, similarity_score,
  confidence_band, human_confirmed, created_at

community_cases
  id, consent_status, anonymized_machine_context, symptom,
  confirmed_resolution, review_status, created_at
```

## Success criteria

- A first-time technician can record a sound and receive a clear next action in under 30 seconds.
- Every sound result shows confidence, evidence source, and an easy way to say “this is not correct.”
- Unsafe vehicle or machine symptoms are escalated rather than guessed.
- The system is measurably more helpful than generic chat: fewer repeated questions and more confirmed diagnoses.
- No personal or vehicle-identifying data is used without explicit consent.

## What we will not claim

- Sound alone can diagnose every mechanical problem.
- Bambara voice support is fully reliable before it is tested with native speakers and real workshop vocabulary.
- The WhatsApp simulator is an official WhatsApp integration.
- Community reports are equivalent to manufacturer documentation.
