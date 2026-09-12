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

1. Explain: “This is a diagnostic agent, not a generic chatbot. It remembers evidence, proposes one safe test, and updates its decision.”
2. Click **Load Epson demo example** and submit it.
3. Point out the current test, provider label, safety area, and persistent diagnostic state.
4. Reply with a realistic result, for example: “The sensor lever returns freely.”
5. Show that the same session receives an updated next test rather than restarting the conversation.
6. Start a new session with **New session** to reset the demo state.
7. Attach a clear printer-mechanism or error-display photo to demonstrate the vision path.
8. If Exa is configured, point out sources shown in **Technical evidence**.

## Recovery plan

- If DeepSeek is temporarily unavailable, the application returns a safe low-risk fallback instead of inventing a diagnosis.
- If Exa is unavailable, the diagnostic loop continues without external sources.
- If the network is unreliable, use the text dashboard and explain that the safe fallback protects the technician until a provider is available.

## Non-negotiable safety message

The agent must never recommend a high-risk remote manipulation. It escalates that case to an experienced technician.
