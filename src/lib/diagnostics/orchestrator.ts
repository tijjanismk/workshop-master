import OpenAI from "openai";
import { z } from "zod";

import { retrieveTechnicalEvidence } from "@/lib/retrieval/exa";

import { createSession, getSession, saveSession } from "./session-store";
import type { AgentDecision, DiagnosticSession, DiagnosticTest, Hypothesis } from "./types";

const decisionSchema = z.object({
  assistantMessage: z.string().min(1),
  machine: z.object({
    manufacturer: z.string().optional(),
    model: z.string().optional(),
    type: z.string().optional(),
  }),
  observations: z.array(z.string().min(1)).max(5),
  visualObservations: z.array(z.string().min(1)).max(5),
  hypotheses: z.array(
    z.object({
      title: z.string().min(1),
      rationale: z.string().min(1),
      confidence: z.enum(["low", "medium", "high"]),
      status: z.enum(["open", "supported", "ruled_out"]),
    }),
  ).max(4),
  nextTest: z
    .object({
      title: z.string().min(1),
      instruction: z.string().min(1),
      purpose: z.string().min(1),
      risk: z.enum(["low", "medium", "high"]),
      requiresPowerOff: z.boolean(),
    })
    .nullable(),
  safetyWarnings: z.array(z.string().min(1)).max(4),
  status: z.enum(["active", "resolved", "escalated"]),
});

const decisionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "assistantMessage",
    "machine",
    "observations",
    "visualObservations",
    "hypotheses",
    "nextTest",
    "safetyWarnings",
    "status",
  ],
  properties: {
    assistantMessage: { type: "string" },
    machine: {
      type: "object",
      additionalProperties: false,
      required: ["manufacturer", "model", "type"],
      properties: {
        manufacturer: { type: "string" },
        model: { type: "string" },
        type: { type: "string" },
      },
    },
    observations: { type: "array", items: { type: "string" } },
    visualObservations: { type: "array", items: { type: "string" } },
    hypotheses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "rationale", "confidence", "status"],
        properties: {
          title: { type: "string" },
          rationale: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          status: { type: "string", enum: ["open", "supported", "ruled_out"] },
        },
      },
    },
    nextTest: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["title", "instruction", "purpose", "risk", "requiresPowerOff"],
          properties: {
            title: { type: "string" },
            instruction: { type: "string" },
            purpose: { type: "string" },
            risk: { type: "string", enum: ["low", "medium", "high"] },
            requiresPowerOff: { type: "boolean" },
          },
        },
        { type: "null" },
      ],
    },
    safetyWarnings: { type: "array", items: { type: "string" } },
    status: { type: "string", enum: ["active", "resolved", "escalated"] },
  },
} as const;

const agentInstructions = `You are The Workshop Master, a remote expert maintenance technician.
Guide a technician through one physical diagnostic test at a time.
Use short, plain sentences that can be understood by a person with limited literacy. Prefer everyday words over technical jargon, explain a technical word when it is necessary, and ask for only one observation at a time.
Separate observed facts, technician statements, retrieved evidence, and hypotheses.
Never state a hypothesis as confirmed. Do not invent a diagnosis.
Treat retrievedSources in the session as external evidence, not as technician observations.
Update machine only from explicit technician evidence. Use an empty string for any unknown machine field.
Before asking a question, inspect the full session: machine fields, symptoms, observations, currentTest, and completed tests.
Never ask again for a manufacturer, model, error code, symptom, or test result already present anywhere in the session.
Treat the new technician statement as the result of the current test whenever a currentTest exists. Advance the diagnostic state instead of restarting intake.
If a manufacturer, model, or error code appears in any technician observation, extract it into machine and use it in the next test.
Only request missing information when it is necessary for the next lowest-risk decision. Do not use generic intake questions after the first turn.
Before any physical manipulation, include concise safety instructions when necessary.
Prefer the lowest-risk test with the highest information value.
Return the complete updated list of hypotheses, not only newly created hypotheses.
Set nextTest to null when the session is resolved or must be escalated. Never propose a high-risk test.
When an image is attached, put only visible technical facts in visualObservations. Do not claim unseen defects.
Return only the requested JSON schema.`;

export type ProcessTurnResult = {
  session: DiagnosticSession;
  decision: AgentDecision;
  provider: "deepseek" | "openrouter" | "safe-fallback";
};

type ProviderDecision = {
  decision: AgentDecision;
  provider: ProcessTurnResult["provider"];
};

export type SupportedLanguage = "en" | "fr" | "bm" | "zh";

const languageInstruction: Record<SupportedLanguage, string> = {
  en: "Reply in English.",
  fr: "Reply in French.",
  bm: "Reply in Bambara when possible. If you are uncertain about Bambara terminology, say so briefly and use simple French.",
  zh: "Reply in Simplified Chinese.",
};

function buildFallbackDecision(
  language: SupportedLanguage,
  session?: DiagnosticSession,
): AgentDecision {
  if (session && session.observations.length > 1) {
    const unavailable = {
      en: "I retained the full diagnostic context, but the AI provider is unavailable. I will not repeat earlier intake questions or recommend a new physical test without a reliable decision.",
      fr: "J’ai conservé tout le contexte du diagnostic, mais le fournisseur IA est indisponible. Je ne vais ni répéter les questions déjà posées ni recommander un nouveau test sans décision fiable.",
      bm: "N y'a sɛgɛsɛgɛli kɔrɔbɔ bɛɛ mara, nka IA fournisseur tɛ se sisan. N tɛna ɲininkali kɔrɔw segin walima test kura fɔ ni dɔnni ɲuman tɛ.",
      zh: "我已保留完整的诊断上下文，但 AI 服务当前不可用。为保证安全，我不会重复已回答的问题，也不会在没有可靠判断时建议新的操作。",
    }[language];
    return {
      assistantMessage: unavailable,
      machine: {},
      observations: [],
      visualObservations: [],
      hypotheses: session.hypotheses.map((hypothesis) => ({
        title: hypothesis.title,
        rationale: hypothesis.rationale,
        confidence: hypothesis.confidence,
        status: hypothesis.status,
      })),
      nextTest: undefined,
      safetyWarnings: [],
      status: "active",
    };
  }
  const fallback = {
    en: {
      message: "I recorded the reported symptom. Before touching the machine, identify its manufacturer, exact model, and any displayed error code or LED pattern.",
      title: "Identify the machine and fault signal",
      instruction: "Without opening the machine, send the manufacturer, exact model, and the error code or LED pattern currently shown.",
      purpose: "This establishes the correct troubleshooting path without assuming a diagnosis.",
    },
    fr: {
      message: "J’ai enregistré le symptôme. Avant de toucher la machine, indique le fabricant, le modèle exact et tout code d’erreur ou voyant visible.",
      title: "Identifier la machine et le signal de panne",
      instruction: "Sans ouvrir la machine, envoie le fabricant, le modèle exact et le code d’erreur ou les voyants visibles.",
      purpose: "Cela établit le bon parcours de diagnostic sans supposer une panne.",
    },
    bm: {
      message: "N y'a gɛlɛnko sɛbɛn. Masinɲɛ kana bɔ fɔlɔ; a kɛla, a modele ani erreur code walima voyants fɔ.",
      title: "Masinɲɛ ani panne tɔgɔ dɔn",
      instruction: "Masinɲɛ kana da; a kɛla, a modele ani erreur code walima voyants min bɛ ye fɔ.",
      purpose: "A bɛ se ka sɛgɛsɛgɛli sira ɲuman da ka fɔlɔ, ka miiri tɛgɛ.",
    },
    zh: {
      message: "我已记录该症状。请先不要拆动设备，并提供制造商、准确型号、错误代码或指示灯状态。",
      title: "确认设备与故障信号",
      instruction: "不要打开设备；请发送制造商、准确型号以及当前显示的错误代码或指示灯状态。",
      purpose: "在不假设故障原因的前提下，建立正确的诊断路径。",
    },
  }[language];
  return {
    assistantMessage: fallback.message,
    machine: {},
    observations: [],
    visualObservations: [],
    hypotheses: [],
    nextTest: {
      title: fallback.title,
      instruction: fallback.instruction,
      purpose: fallback.purpose,
      risk: "low",
      requiresPowerOff: false,
    },
    safetyWarnings: [],
    status: "active",
  };
}

function buildModelContext(session: DiagnosticSession) {
  return {
    id: session.id,
    machine: session.machine,
    symptoms: session.symptoms.slice(-5),
    observations: session.observations.slice(-12).map(({ source, text, createdAt }) => ({
      source,
      text,
      createdAt,
    })),
    hypotheses: session.hypotheses.map(({ title, rationale, confidence, status }) => ({
      title,
      rationale,
      confidence,
      status,
    })),
    currentTest: session.currentTest,
    recentTests: session.tests.slice(-3),
    retrievedSources: session.retrievedSources.slice(0, 3).map((source) => ({
      title: source.title,
      url: source.url,
      highlights: source.highlights.map((highlight) => highlight.slice(0, 600)),
    })),
    safetyWarnings: session.safetyWarnings.slice(-5),
    status: session.status,
  };
}

async function requestModelDecision(
  session: DiagnosticSession,
  message: string,
  imageDataUrl?: string,
  language: SupportedLanguage = "en",
): Promise<ProviderDecision> {
  const prompt = `Diagnostic session:\n${JSON.stringify(buildModelContext(session))}\n\nNew technician statement:\n${message}\n\nImage attached: ${Boolean(imageDataUrl)}`;

  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const client = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: "https://api.deepseek.com",
        timeout: 12_000,
        maxRetries: 0,
      });
      const response = await client.responses.create({
        model:
          (imageDataUrl ? process.env.DEEPSEEK_VISION_MODEL : process.env.DEEPSEEK_TEXT_MODEL) ??
          process.env.DEEPSEEK_MODEL ??
          "deepseek-v4-flash",
        store: false,
        instructions: `${agentInstructions}\n${languageInstruction[language]}`,
        input: imageDataUrl
          ? [
              {
                role: "user",
                content: [
                  { type: "input_text", text: prompt },
                  { type: "input_image", image_url: imageDataUrl, detail: "auto" },
                ],
              },
            ]
          : prompt,
        text: {
          format: {
            type: "json_schema",
            name: "diagnostic_decision",
            strict: true,
            schema: decisionJsonSchema,
          },
        },
      });

      const parsed = decisionSchema.parse(JSON.parse(response.output_text));
      return {
        decision: { ...parsed, nextTest: parsed.nextTest ?? undefined },
        provider: "deepseek",
      };
    } catch (error) {
      console.warn("DeepSeek decision failed; attempting configured fallback.", error);
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      timeout: 12_000,
      maxRetries: 0,
    });
    const response = await client.chat.completions.create({
      model: process.env.OPENROUTER_MODEL ?? "openrouter/free",
      messages: imageDataUrl
        ? [
            { role: "system", content: `${agentInstructions}\n${languageInstruction[language]}` },
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageDataUrl } },
              ],
            },
          ]
        : [
            { role: "system", content: `${agentInstructions}\n${languageInstruction[language]}` },
            { role: "user", content: prompt },
          ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "diagnostic_decision",
          strict: true,
          schema: decisionJsonSchema,
        },
      },
    });
    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new Error("OpenRouter returned an empty diagnostic decision.");
    }
    const parsed = decisionSchema.parse(JSON.parse(content));
    return {
      decision: { ...parsed, nextTest: parsed.nextTest ?? undefined },
      provider: "openrouter",
    };
  }

  return { decision: buildFallbackDecision(language, session), provider: "safe-fallback" };
}

function applyDecision(session: DiagnosticSession, decision: AgentDecision): void {
  const now = new Date().toISOString();

  session.machine = {
    ...session.machine,
    ...Object.fromEntries(
      Object.entries(decision.machine).filter(([, value]) => Boolean(value)),
    ),
  };

  for (const text of decision.observations) {
    session.observations.push({
      id: crypto.randomUUID(),
      source: "agent",
      text,
      createdAt: now,
    });
  }

  for (const text of decision.visualObservations) {
    session.observations.push({
      id: crypto.randomUUID(),
      source: "vision",
      text,
      createdAt: now,
    });
  }

  session.hypotheses = decision.hypotheses.map((hypothesis): Hypothesis => ({
    ...hypothesis,
    id: crypto.randomUUID(),
  }));
  const safetyWarnings = [...decision.safetyWarnings];
  if (decision.nextTest?.requiresPowerOff) {
    safetyWarnings.push("Turn off and unplug the machine before this test.");
  }

  if (decision.nextTest?.risk === "high") {
    safetyWarnings.push(
      "Do not perform a high-risk operation remotely. Escalate to an experienced technician.",
    );
    decision.nextTest = undefined;
    decision.status = "escalated";
  }

  session.safetyWarnings = [...new Set([...session.safetyWarnings, ...safetyWarnings])];
  session.status = decision.status;

  if (decision.nextTest) {
    const test: DiagnosticTest = {
      ...decision.nextTest,
      id: crypto.randomUUID(),
      createdAt: now,
    };
    session.tests.push(test);
    session.currentTest = test;
  }
}

export async function processTechnicianMessage(
  sessionId: string | undefined,
  message: string,
  imageDataUrl?: string,
  language: SupportedLanguage = "en",
): Promise<ProcessTurnResult> {
  const session = sessionId ? getSession(sessionId) : createSession();
  if (!session) {
    throw new Error("Diagnostic session not found.");
  }

  session.observations.push({
    id: crypto.randomUUID(),
    source: "technician",
    text: message,
    createdAt: new Date().toISOString(),
  });
  if (session.symptoms.length === 0) {
    session.symptoms.push(message);
  }

  const retrievedSources = await retrieveTechnicalEvidence(session, message);
  if (retrievedSources.length > 0) {
    session.retrievedSources = retrievedSources;
  }

  try {
    const result = await requestModelDecision(session, message, imageDataUrl, language);
    applyDecision(session, result.decision);
    saveSession(session);

    return { session, ...result };
  } catch (error) {
    console.error("Diagnostic decision failed", error);
    const decision = buildFallbackDecision(language, session);
    applyDecision(session, decision);
    saveSession(session);

    return { session, decision, provider: "safe-fallback" };
  }
}
