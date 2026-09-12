# Hackathon Demo Runbook

## Before the demo

1. Create `.env.local` from `.env.example`.
2. Add the DeepSeek key locally. Never display it during the demo.
3. Optionally add `EXA_API_KEY` to enable technical source retrieval.
4. Start the application:

```powershell
npm install
npm run dev
```

5. Open `http://localhost:3000` on the presentation laptop.

### Optional Telegram channel

Set these values in `.env.local`:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```

Deploy the app to a public HTTPS URL, then configure Telegram’s webhook target as:

```text
https://YOUR_PUBLIC_DOMAIN/api/channels/telegram
```

Use the same secret in Telegram’s `secret_token` webhook setting and in `TELEGRAM_WEBHOOK_SECRET`.

## Demonstration script

1. Explain in plain language: “Tell it what you see. It remembers what you said and gives one safe thing to check.”
2. Click **Load Epson demo example** and submit the short message: “Epson L3210. It says paper jam. I see no paper.”
3. Point out the single next action, the safety instruction, and the Epson sources shown in **Technical evidence**.
4. Reply with a simple result: “The small lever moves freely. The red light stays on.”
5. Show that the next answer uses this result and does not ask again for the printer model.
6. Start a new session with **New session**.
7. Run the garage example by typing: “Toyota. The car does not start. The dashboard lights come on.”
8. Reply: “The starter makes one click. The engine does not turn.” Explain that the agent asks for one safe observation before suggesting any repair.
9. Attach a clear printer mechanism, dashboard warning light, or error-display photo to demonstrate the vision path.

## Plain-language design rule

The product is designed for people who may prefer speaking or short messages over technical writing. Good input is a short observation, for example:

- “The car makes one click.”
- “The red light stays on.”
- “It pulls paper but does not print.”
- “There is a burning smell.”

The agent must answer with short steps, avoid unexplained technical words, and never shame someone for not knowing a model number or part name.

## Recovery plan

- If DeepSeek is temporarily unavailable, the application returns a safe low-risk fallback instead of inventing a diagnosis.
- If Exa is unavailable, the diagnostic loop continues without external sources.
- If the network is unreliable, use the text dashboard and explain that the safe fallback protects the technician until a provider is available.

## Non-negotiable safety message

The agent must never recommend a high-risk remote manipulation. It escalates that case to an experienced technician.
