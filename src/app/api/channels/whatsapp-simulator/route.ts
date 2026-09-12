import { z } from "zod";

import { processTechnicianMessage } from "@/lib/diagnostics/orchestrator";

export const runtime = "nodejs";

const requestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(2_000),
  language: z.enum(["en", "fr", "bm", "zh"]).default("fr"),
});

export async function POST(request: Request) {
  const payload = requestSchema.safeParse(await request.json());
  if (!payload.success) {
    return Response.json({ error: "A short message is required." }, { status: 400 });
  }

  const result = await processTechnicianMessage(
    payload.data.sessionId,
    payload.data.message,
    undefined,
    payload.data.language,
  );

  return Response.json({
    sessionId: result.session.id,
    reply: result.decision.assistantMessage,
    nextTest: result.decision.nextTest?.instruction,
    provider: result.provider,
  });
}
