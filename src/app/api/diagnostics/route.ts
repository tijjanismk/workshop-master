import { z } from "zod";

import { processTechnicianMessage } from "@/lib/diagnostics/orchestrator";

export const runtime = "nodejs";

const requestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(2_000),
  language: z.enum(["en", "fr", "bm", "zh"]).default("en"),
  imageDataUrl: z
    .string()
    .max(7_000_000)
    .regex(/^data:image\/(jpeg|png|webp|gif);base64,/, "Unsupported image format.")
    .optional(),
});

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: "A message between 1 and 2,000 characters is required." },
      { status: 400 },
    );
  }

  try {
    const result = await processTechnicianMessage(
      parsed.data.sessionId,
      parsed.data.message,
      parsed.data.imageDataUrl,
      parsed.data.language,
    );
    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error("Diagnostic request failed", error);
    return Response.json(
      { error: "The diagnostic session could not be processed." },
      { status: 500 },
    );
  }
}
