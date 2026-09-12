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

type SourceType = TechnicalSource["sourceType"];

function hasTechnicalIdentifier(message: string) {
  return /\b(epson|canon|brother|xerox|samsung|ricoh|hp|toyota|honda|ford|renault|peugeot|bmw|mercedes|volkswagen|vw|l\d{3,4}|e[- ]?\d+|0x[0-9a-f]+|p0\d{3})\b/i.test(
    message,
  );
}

function queryKey(message: string) {
  return message.trim().toLocaleLowerCase().replace(/\s+/g, " ").slice(0, 300);
}

function buildEquipmentContext(session: DiagnosticSession, message: string) {
  const machine = [session.machine.manufacturer, session.machine.model, session.machine.type]
    .filter(Boolean)
    .join(" ");
  return [machine, message].filter(Boolean).join(" — ").slice(0, 1_000);
}

async function searchEvidence(
  query: string,
  requestedSourceType: SourceType,
  manufacturer?: string,
): Promise<TechnicalSource[]> {
  try {
    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.EXA_API_KEY ?? "",
      },
      body: JSON.stringify({
        query,
        type: "auto",
        numResults: 2,
        contents: { highlights: { query, maxCharacters: 700 } },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.warn(`Exa ${requestedSourceType} search unavailable: ${response.status}`);
      return [];
    }

    const payload = exaResponseSchema.parse(await response.json());
    return payload.results.map((result) => ({
      title: result.title,
      url: result.url,
      highlights: result.highlights,
      sourceType: classifySource(result.url, requestedSourceType, manufacturer),
      query,
    }));
  } catch (error) {
    console.warn(`Exa ${requestedSourceType} retrieval failed.`, error);
    return [];
  }
}

function classifySource(
  url: string,
  requestedSourceType: SourceType,
  manufacturer?: string,
): SourceType {
  const host = new URL(url).hostname.toLowerCase();
  if (requestedSourceType === "video") {
    return /(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/.test(host) ? "video" : "web";
  }
  if (requestedSourceType === "community") {
    return /(^|\.)(reddit\.com|ifixit\.com|stackexchange\.com)$/.test(host) ||
      host.includes("forum") || host.includes("community")
      ? "community"
      : "web";
  }
  if (requestedSourceType === "manufacturer" && manufacturer) {
    const brand = manufacturer.toLowerCase().replace(/[^a-z0-9]/g, "");
    return brand.length >= 3 && host.replace(/[^a-z0-9]/g, "").includes(brand)
      ? "manufacturer"
      : "web";
  }
  return "web";
}

/**
 * Evidence routine: authoritative manuals first, then clearly-labelled
 * community and video sources. The agent receives the source type and must
 * never present a forum or video claim as manufacturer-confirmed.
 */
export async function retrieveTechnicalEvidence(
  session: DiagnosticSession,
  message: string,
): Promise<TechnicalSource[]> {
  const key = queryKey(message);
  if (
    !process.env.EXA_API_KEY ||
    session.retrievalQueries?.includes(key) ||
    !hasTechnicalIdentifier(message)
  ) {
    return [];
  }

  const context = buildEquipmentContext(session, message);
  const searches: Array<{ sourceType: SourceType; query: string }> = [
    {
      sourceType: "manufacturer",
      query: `Official manufacturer service manual, support documentation, and low-risk troubleshooting procedure for: ${context}`,
    },
    {
      sourceType: "community",
      query: `Technician forum discussions and practical field experience for: ${context}. Community evidence only, not official documentation.`,
    },
    {
      sourceType: "video",
      query: `YouTube repair or troubleshooting demonstration for: ${context}. Video evidence only, verify before applying a repair.`,
    },
  ];

  const groups = await Promise.all(
    searches.map(({ query, sourceType }) =>
      searchEvidence(query, sourceType, session.machine.manufacturer),
    ),
  );
  const seen = new Set<string>();
  return groups.flat().filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

export function markTechnicalQueryRetrieved(session: DiagnosticSession, message: string): void {
  const key = queryKey(message);
  session.retrievalQueries = [...new Set([...(session.retrievalQueries ?? []), key])].slice(-12);
}
