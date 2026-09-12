import { z } from "zod";

import type { DiagnosticSession, TechnicalSource } from "@/lib/diagnostics/types";

const exaResponseSchema = z.object({
  results: z.array(
    z.object({
      title: z.string().catch("Untitled source"),
      url: z.string().url(),
      highlights: z.array(z.string()).optional().default([]),
    }),
  ).default([]),
});

function hasTechnicalIdentifier(message: string) {
  return /\b(epson|canon|brother|xerox|samsung|ricoh|hp|toyota|honda|ford|renault|peugeot|bmw|mercedes|volkswagen|vw|l\d{3,4}|e[- ]?\d+|0x[0-9a-f]+|p0\d{3})\b/i.test(
    message,
  );
}

export async function retrieveTechnicalEvidence(
  session: DiagnosticSession,
  message: string,
): Promise<TechnicalSource[]> {
  if (
    !process.env.EXA_API_KEY ||
    (session.retrievedSources?.length ?? 0) > 0 ||
    !hasTechnicalIdentifier(message)
  ) {
    return [];
  }

  const query = `Official manufacturer service documentation and low-risk troubleshooting procedure for: ${message}`;

  try {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.EXA_API_KEY,
      },
      body: JSON.stringify({
        query,
        type: "auto",
        numResults: 3,
        contents: {
          highlights: { query, maxCharacters: 800 },
        },
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.warn(`Exa search unavailable: ${response.status}`);
      return [];
    }

    const payload = exaResponseSchema.parse(await response.json());
    return payload.results.map((result) => ({
      title: result.title,
      url: result.url,
      highlights: result.highlights,
    }));
  } catch (error) {
    console.warn("Exa technical retrieval failed.", error);
    return [];
  }
}
