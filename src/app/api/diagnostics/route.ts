import { z } from "zod";

import { processTechnicianMessage } from "@/lib/diagnostics/orchestrator";

export const runtime = "nodejs";

const testSnapshotSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(300),
  instruction: z.string().min(1).max(2_000),
  purpose: z.string().min(1).max(2_000),
  risk: z.enum(["low", "medium", "high"]),
  requiresPowerOff: z.boolean(),
  createdAt: z.string().datetime(),
});

// Snapshot recovery supports the stateless Vercel demo, but it must still be
// structurally validated before it is allowed back into the diagnostic flow.
const sessionSnapshotSchema = z.object({
  id: z.string().uuid(),
  machine: z.object({
    manufacturer: z.string().max(200).optional(),
    model: z.string().max(200).optional(),
    type: z.string().max(200).optional(),
  }),
  symptoms: z.array(z.string().min(1).max(2_000)).max(20),
  observations: z.array(z.object({
    id: z.string().uuid(),
    source: z.enum(["technician", "agent", "retrieval", "vision"]),
    text: z.string().min(1).max(4_000),
    createdAt: z.string().datetime(),
  })).max(60),
  hypotheses: z.array(z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(500),
    rationale: z.string().min(1).max(2_000),
    confidence: z.enum(["low", "medium", "high"]),
    status: z.enum(["open", "supported", "ruled_out"]),
  })).max(12),
  tests: z.array(testSnapshotSchema).max(30),
  retrievedSources: z.array(z.object({
    title: z.string().min(1).max(500),
    url: z.string().url(),
    highlights: z.array(z.string().max(1_000)).max(6),
    sourceType: z.enum(["manufacturer", "community", "video", "web"]).default("web"),
    query: z.string().max(2_000).default(""),
  })).max(12),
  retrievalQueries: z.array(z.string().min(1).max(300)).max(12).default([]),
  currentTest: testSnapshotSchema.optional(),
  safetyWarnings: z.array(z.string().min(1).max(1_000)).max(12),
  status: z.enum(["active", "resolved", "escalated"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const requestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(2_000),
  language: z.enum(["en", "fr", "bm", "zh"]).default("en"),
  role: z.enum(["apprentice", "technician", "owner"]).default("technician"),
  imageDataUrl: z
    .string()
    .max(7_000_000)
    .regex(/^data:image\/(jpeg|png|webp|gif);base64,/, "Unsupported image format.")
    .optional(),
  // This preserves a web demo across Vercel instances. It is fully validated,
  // but durable shared storage remains the production-ready solution.
  sessionSnapshot: sessionSnapshotSchema.optional(),
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
      parsed.data.sessionSnapshot,
      parsed.data.role,
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
