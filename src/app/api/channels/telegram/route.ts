import { formatChannelResponse } from "@/lib/channels/format-response";
import {
  processTechnicianMessage,
  type SupportedLanguage,
} from "@/lib/diagnostics/orchestrator";
import { getOrCreateChannelSession } from "@/lib/diagnostics/session-store";

export const runtime = "nodejs";

type TelegramPhoto = { file_id?: string };
type TelegramUpdate = {
  message?: {
    chat?: { id?: number | string };
    text?: string;
    caption?: string;
    photo?: TelegramPhoto[];
    from?: { language_code?: string };
  };
};

function languageFromTelegram(code: string | undefined): SupportedLanguage {
  const language = code?.toLowerCase() ?? "";
  if (language.startsWith("fr")) return "fr";
  if (language.startsWith("zh")) return "zh";
  return "en";
}

async function getTelegramImage(fileId: string, token: string): Promise<string | undefined> {
  const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  const filePayload = (await fileResponse.json()) as {
    ok?: boolean;
    result?: { file_path?: string };
  };
  if (!filePayload.ok || !filePayload.result?.file_path) {
    return undefined;
  }

  const download = await fetch(
    `https://api.telegram.org/file/bot${token}/${filePayload.result.file_path}`,
  );
  if (!download.ok || Number(download.headers.get("content-length") ?? 0) > 5 * 1024 * 1024) {
    return undefined;
  }

  const bytes = Buffer.from(await download.arrayBuffer());
  if (bytes.length > 5 * 1024 * 1024) {
    return undefined;
  }

  return `data:${download.headers.get("content-type") ?? "image/jpeg"};base64,${bytes.toString("base64")}`;
}

async function sendTelegramMessage(chatId: number | string, text: string, token: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!response.ok) {
    console.error(`Telegram reply failed: ${response.status}`);
  }
}

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return Response.json({ error: "Telegram is not configured." }, { status: 503 });
  }

  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret && request.headers.get("x-telegram-bot-api-secret-token") !== expectedSecret) {
    return Response.json({ error: "Invalid Telegram webhook secret." }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const message = update.message;
  const chatId = message?.chat?.id;
  if (!message || chatId === undefined) {
    return Response.json({ ok: true });
  }

  const photo = message.photo?.at(-1)?.file_id;
  const imageDataUrl = photo ? await getTelegramImage(photo, token) : undefined;
  const text =
    message.text?.trim() ||
    message.caption?.trim() ||
    (imageDataUrl ? "Please analyze the attached image." : "");
  if (!text) {
    await sendTelegramMessage(chatId, "Send a text message or a photo with a caption.", token);
    return Response.json({ ok: true });
  }

  const session = getOrCreateChannelSession("telegram", String(chatId));
  const result = await processTechnicianMessage(
    session.id,
    text,
    imageDataUrl,
    languageFromTelegram(message.from?.language_code),
  );
  await sendTelegramMessage(chatId, formatChannelResponse(result), token);

  return Response.json({ ok: true });
}
