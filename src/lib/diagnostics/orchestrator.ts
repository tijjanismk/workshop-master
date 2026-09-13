import OpenAI from "openai";
import { z } from "zod";

import { markTechnicalQueryRetrieved, retrieveTechnicalEvidence } from "@/lib/retrieval/exa";

import { createSession, getSession, saveSession } from "./session-store";
import type { AgentDecision, DiagnosticSession, DiagnosticTest, Hypothesis } from "./types";

const decisionSchema = z.object({
  assistantMessage: z.string().min(1),
  followUpQuestions: z.array(z.object({
    question: z.string().min(1).max(300),
    choices: z.array(z.string().min(1).max(160)).min(2).max(5),
  })).max(3),
  customerReply: z.string().max(700),
  technicalRecap: z.string().min(1).max(1_200),
  learningBrief: z.string().min(1).max(900),
  communityLeads: z.array(z.object({
    sourceTitle: z.string().min(1).max(500),
    insight: z.string().min(1).max(900),
    safeConfirmation: z.string().min(1).max(900),
  })).max(3),
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
    "followUpQuestions",
    "customerReply",
    "technicalRecap",
    "learningBrief",
    "communityLeads",
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
    followUpQuestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "choices"],
        properties: { question: { type: "string" }, choices: { type: "array", items: { type: "string" } } },
      },
    },
    customerReply: { type: "string" },
    technicalRecap: { type: "string" },
    learningBrief: { type: "string" },
    communityLeads: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourceTitle", "insight", "safeConfirmation"],
        properties: {
          sourceTitle: { type: "string" },
          insight: { type: "string" },
          safeConfirmation: { type: "string" },
        },
      },
    },
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
Treat the technician as competent. Do not lecture, patronize, praise obvious actions, or restart with a generic welcome/intake script.
Adapt to the level shown in the technician's messages: use concise technical language when they provide precise model, error-code, measurement, or repair information; simplify only when they ask for it.
Accept clear technician statements as evidence. Do not ask them to repeat, prove, or reconfirm a fact already stated unless a safety-critical ambiguity makes it necessary. State that ambiguity and ask the smallest possible clarifying question.
When the technician provides a test result, acknowledge it in one short phrase, update the hypothesis, and move directly to the most useful next action. Never repeat the entire session back to them.
If the technician asks a direct technical question, answer it first from the session and retrieved evidence; only then give one next test if it is needed.
Recognize when the technician changes from repair to workshop operations: client reception, delayed collection, price, payment, complaint, retention, or appointment. Stop the repair interrogation immediately, answer the operational need directly, and do not force the prior diagnostic questions.
Return customerReply only when the turn is about workshop operations: a short, respectful message the technician can say or send. Otherwise return an empty string.
Separate observed facts, technician statements, retrieved evidence, and hypotheses.
Separate the reported symptom from the probable underlying problem. Do not anchor on the first component or fault named by the technician, a forum, or a video.
Maintain competing hypotheses when the evidence permits it, and choose the next low-risk test for its ability to distinguish between the most plausible causes.
When evidence is insufficient or conflicts, say what is uncertain and orient the technician toward the observation that will most efficiently identify the real problem.
For a vague vehicle complaint, never suggest turning the key, starting, revving, driving, opening a hot engine bay, or touching moving parts. First identify the symptom category and screen for urgent danger.
If the technician reports brake/steering loss, smoke, fuel smell/leak, severe overheating, or a red warning light, tell them not to start or drive the vehicle and escalate before any diagnosis.
Never state a hypothesis as confirmed. Do not invent a diagnosis.
Use the evidence routine in this order: the active session context and technician observations; manufacturer documentation; clearly-labelled forum/community reports; clearly-labelled YouTube/video demonstrations; then your general technical knowledge.
Treat retrievedSources in the session as external evidence, not as technician observations. Use sourceType to identify its reliability: manufacturer is preferred; community and video are leads that require a safe confirmation.
Return technicalRecap as a 2–4 sentence explanation of the mechanism behind the present diagnostic path; distinguish what is known from what is only likely.
Return learningBrief as one short, practical lesson that helps the technician understand the equipment or symptom without repeating the next action.
Return communityLeads only for retrievedSources whose sourceType is community. Each lead must use the exact retrieved source title, call its insight a community report rather than a fact, and give one low-risk confirmation. Return [] when no relevant community source exists.
Your general technical knowledge is not a retrieved source and must never be presented as a manual, a forum finding, or proof. State it as a hypothesis when relevant.
Update machine only from explicit technician evidence. Use an empty string for any unknown machine field.
Before asking a question, inspect the full session: machine fields, symptoms, observations, currentTest, and completed tests.
Never ask again for a manufacturer, model, error code, symptom, or test result already present anywhere in the session.
Return followUpQuestions with zero to three questions only when their answers would change the next diagnostic decision. Each question needs 2–5 concise, mutually exclusive choices in the user's language. Base them on the first reported fault and current evidence; never return generic intake questions. Return [] when the next safe action is already clear.
Treat the new technician statement as the result of the current test whenever a currentTest exists. Advance the diagnostic state instead of restarting intake.
If a manufacturer, model, or error code appears in any technician observation, extract it into machine and use it in the next test.
Only request missing information when it is necessary for the next lowest-risk decision. Do not use generic intake questions after the first turn.
Before any physical manipulation, include concise safety instructions when necessary.
Prefer the lowest-risk test with the highest information value.
Return the complete updated list of hypotheses, not only newly created hypotheses.
Set nextTest to null when the session is resolved or must be escalated. Never propose a high-risk test.
Do not put the next test or safety warning verbatim inside assistantMessage: those are rendered separately by the channel.
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

function isVehicleReport(message: string) {
  return /\b(voiture|véhicule|vehicule|auto|car|vehicle|moto|motorcycle|camion|truck)\b/i.test(
    message,
  );
}

function isWorkshopOperationsMessage(message: string) {
  const hasClient = /\b(client|customer|customers|cliente)\b/i.test(message);
  const hasOperationsSignal = /\b(revenu|revient|revenir|récupér|recuper|prendre son téléphone|prendre son telephone|retard|prix|paiement|mécontent|mecontent|plainte|perdre.*client|fidélis|fidelis|rendez[- ]?vous|appointment)\b/i.test(message);
  return hasClient && hasOperationsSignal;
}

function buildWorkshopOperationsDecision(message: string, language: SupportedLanguage): AgentDecision | undefined {
  if (!isWorkshopOperationsMessage(message)) return undefined;
  const copy = {
    en: { message: "This is a customer-service moment, not a repair question. Acknowledge the customer first, state what is ready or what will happen next, and give a precise time if there is a delay.", recap: "Clear expectations reduce lost customers more reliably than continuing a technical diagnosis while the customer is waiting.", lesson: "When the business context changes, pause the repair flow and handle the customer’s immediate need first.", title: "Clarify the customer need", instruction: "Choose the customer situation below, then respond with one clear commitment.", purpose: "This protects trust before returning to the repair workflow.", question: "What does the customer need now?", choices: ["Collect a finished device", "A delay update", "Price or payment explanation", "Complaint or reassurance"] },
    fr: { message: "Ici, c’est un moment de relation client, pas une question de réparation. Accueille d’abord le client, dis ce qui est prêt ou la prochaine étape, puis donne une heure précise s’il y a un retard.", recap: "Des attentes claires évitent plus facilement de perdre un client que de continuer le diagnostic pendant qu’il attend.", lesson: "Quand le sujet devient commercial, mets le dépannage en pause et traite d’abord le besoin immédiat du client.", title: "Préciser le besoin du client", instruction: "Choisis la situation du client, puis réponds avec un engagement clair.", purpose: "Protéger la confiance avant de reprendre le diagnostic.", question: "De quoi le client a-t-il besoin maintenant ?", choices: ["Récupérer un appareil terminé", "Une information sur le retard", "Une explication du prix ou paiement", "Une réclamation ou rassurance"], customerReply: "Bonjour, merci d’être revenu. Je vérifie tout de suite le statut de votre appareil et je vous donne une réponse claire dans quelques minutes." },
    bm: { message: "Nin ye client dɛmɛ waati ye, a tɛ réparation ɲininkali ye. Client labɛn fɔlɔ, fɛn min bɛ se walima nata fɔ, ni retard bɛ yen waati ɲuman fɔ.", recap: "Client ka miiri kɛlen fɔli bɛ se ka u mara ka tɛmɛ réparation ɲini na ni a bɛ makɔnɔ.", lesson: "Ni baara ye client dɛmɛ kɛ, réparation da dɔrɔn ka client ka wajibi fɔlɔ kɛ.", title: "Client ka wajibi dɔn", instruction: "Client ka cogo sugandi, ka jaabi kelen fɔ ɲuman.", purpose: "Ladiri mara ka fɔlɔ ka réparation segin.", question: "Client b'a fɛ mun sisan ?", choices: ["Appareil ban bɔ", "Retard kunnafoni", "Prix walima paiement fɔli", "Plainte walima rassurance"] },
    zh: { message: "这属于客户服务，而不是维修问题。先接待客户，说明已完成的内容或下一步；如有延误，请给出明确时间。", recap: "客户等待时，清晰的预期管理比继续追问维修问题更能避免客户流失。", lesson: "当话题变为经营或客户服务时，应暂停维修流程，先处理客户当前需求。", title: "明确客户当前需求", instruction: "选择客户情况，然后给出一个明确承诺。", purpose: "先保护客户信任，再回到维修流程。", question: "客户现在需要什么？", choices: ["领取已完成设备", "了解延误情况", "价格或付款说明", "投诉或需要安抚"] },
  }[language];
  return { assistantMessage: copy.message, technicalRecap: copy.recap, learningBrief: copy.lesson, communityLeads: [], followUpQuestions: [{ question: copy.question, choices: copy.choices }], customerReply: "customerReply" in copy ? copy.customerReply : "", machine: {}, observations: [], visualObservations: [], hypotheses: [], nextTest: { title: copy.title, instruction: copy.instruction, purpose: copy.purpose, risk: "low", requiresPowerOff: false }, safetyWarnings: [], status: "active" };
}

function hasUrgentVehicleSignal(message: string) {
  // A technician may explicitly rule out an urgent symptom ("pas de fumée").
  // Strip these negative statements before looking for a positive danger signal.
  const positiveOnly = message.replace(
    /\b(?:pas de|sans|aucune?|no|without)\s+(?:fumée|fumee|smoke|odeur d['’]?essence|fuel smell|fuite d['’]?essence|fuel leak|surchauffe?|overheating|voyant rouge|red warning)\b/gi,
    "",
  );
  return /\b(frein|brake|direction|steering|fumée|fumee|smoke|odeur d['’]?essence|fuel smell|fuite d['’]?essence|fuel leak|surchauff|overheat|voyant rouge|red warning)\b/i.test(positiveOnly);
}

function vehicleTriageLearning(language: SupportedLanguage, urgent: boolean) {
  const copy = {
    en: urgent
      ? { technicalRecap: "A potential safety symptom takes priority over finding the failed part. The vehicle must be secured before a normal diagnosis can continue.", learningBrief: "In vehicle diagnosis, separate immediate danger from the underlying fault before testing anything." }
      : { technicalRecap: "A vehicle fault can involve fuel, air, ignition, engine control, or a non-engine system. The main symptom identifies which area to examine first without guessing.", learningBrief: "A reported breakdown is not yet a diagnosis: the main symptom selects the safe diagnostic path." },
    fr: urgent
      ? { technicalRecap: "Un signe de danger possible passe avant la recherche de la pièce en cause. Le véhicule doit être sécurisé avant de poursuivre un diagnostic normal.", learningBrief: "En diagnostic automobile, il faut d’abord séparer le danger immédiat de la panne à trouver." }
      : { technicalRecap: "Une panne de véhicule peut concerner le carburant, l’air, l’allumage, la gestion du moteur ou une zone hors moteur. Le symptôme principal indique quelle zone examiner d’abord, sans deviner.", learningBrief: "Une panne signalée n’est pas encore un diagnostic : le symptôme principal permet de choisir une piste sûre." },
    bm: urgent
      ? { technicalRecap: "Juguya ka signe bɛ se ka kɛ fɔlɔ ka taa pièce min gɛlɛn bɔ. Voiture ka kan ka kisɛ fɔlɔ ka sɛgɛsɛgɛli tɔ bɛ se ka taa ɲɛ.", learningBrief: "Voiture sɛgɛsɛgɛli na, juguya dɔn fɔlɔ ka fɔlɔ ka panne ɲini." }
      : { technicalRecap: "Véhicule gɛlɛnko bɛ se ka bɔ essence, hawaa, allumage, moteur gestion walima fɛn wɛrɛ na. Gɛlɛnko ba bɛ se ka yɔrɔ min ka kan ka sɛgɛsɛgɛ fɔlɔ dɔn.", learningBrief: "Panne fɔli tɛ diagnostic ye sisan : gɛlɛnko ba bɛ sira kisɛ sugandi." },
    zh: urgent
      ? { technicalRecap: "潜在的安全症状优先于查找故障部件。必须先确保车辆安全，才能继续常规诊断。", learningBrief: "车辆诊断时，应先区分即时危险和需要排查的故障。" }
      : { technicalRecap: "车辆故障可能涉及燃油、空气、点火、发动机控制或非发动机系统。主要症状决定先检查哪个区域，而不是凭猜测判断。", learningBrief: "报告故障并不等于完成诊断；主要症状会指向安全的诊断路径。" },
  }[language];
  return { ...copy, communityLeads: [] };
}

function buildVehicleTriageDecision(
  session: DiagnosticSession,
  message: string,
  language: SupportedLanguage,
): AgentDecision | undefined {
  if (!isVehicleReport(message) || session.currentTest) return undefined;

  const technicianMessages = session.observations.filter(
    (observation) => observation.source === "technician",
  );
  const urgent = hasUrgentVehicleSignal(message);
  const vague = /\b(cassée?|casse|panne|broken|broke|not working|marche pas)\b/i.test(message);
  const motorcycleStall = /\b(moto|motorcycle)\b/i.test(message) && /\b(cale|calage|calee|stall|stalls)\b/i.test(message);
  if (!urgent && !motorcycleStall && (!vague || technicianMessages.length > 1)) return undefined;

  if (urgent) {
    const copy = {
      en: {
        message: "This could be a safety-critical vehicle problem. Do not start or drive it until the risk is checked.",
        title: "Stop and secure the vehicle",
        instruction: "Park safely, switch off the engine if it is running, and tell me which urgent sign you observed: brakes/steering, smoke, fuel smell or leak, overheating, or a red warning light.",
        purpose: "This identifies immediate danger before any diagnostic action.",
        warning: "Do not start or drive the vehicle until the urgent symptom is assessed.",
      },
      fr: {
        message: "Cela peut être une panne automobile dangereuse. Ne démarre pas et ne conduis pas avant d’avoir vérifié le risque.",
        title: "Sécuriser le véhicule",
        instruction: "Gare le véhicule en sécurité, coupe le moteur s’il tourne, puis dis-moi le signe urgent observé : frein/direction, fumée, odeur ou fuite d’essence, surchauffe ou voyant rouge.",
        purpose: "Identifier un danger immédiat avant toute action de diagnostic.",
        warning: "Ne démarre pas et ne conduis pas le véhicule avant l’évaluation du symptôme urgent.",
      },
      bm: {
        message: "Nin bɛ se ka kɛ voiture gɛlɛnko jugu ye. Kana a daminɛ walima a bori ka fɔlɔ.",
        title: "Voiture kisɛ",
        instruction: "Voiture da kisɛ kɛ, moteur dɔgɔ ni a bɛ ta, ka fɔ signe min bɛ i ye : frein/direction, fumée, essence kunun, surchauffe walima voyant rouge.",
        purpose: "Juguya dɔn fɔlɔ ka sɛgɛsɛgɛli kɛ.",
        warning: "Kana voiture daminɛ walima a bori ka fɔlɔ.",
      },
      zh: {
        message: "这可能是车辆安全风险。请先不要启动车辆或驾驶。",
        title: "确保车辆安全",
        instruction: "将车辆停在安全位置；若发动机正在运行则熄火。请说明紧急信号：刹车/转向、冒烟、燃油气味或泄漏、过热，或红色警告灯。",
        purpose: "在诊断前先确认是否存在即时危险。",
        warning: "在评估紧急症状前，请勿启动车辆或驾驶。",
      },
    }[language];
    return {
      assistantMessage: copy.message,
      ...vehicleTriageLearning(language, true),
      machine: { type: "vehicle" },
      observations: [],
      visualObservations: [],
      hypotheses: [],
      nextTest: {
        title: copy.title,
        instruction: copy.instruction,
        purpose: copy.purpose,
        risk: "low",
        requiresPowerOff: false,
      },
      safetyWarnings: [copy.warning],
      status: "active",
    };
  }

  if (motorcycleStall) {
    const copy = {
      en: { message: "A motorcycle that stalls needs a few targeted observations before blaming a part.", title: "Clarify the stalling pattern", instruction: "Answer the short questions below before starting another test.", purpose: "Timing and restart behavior distinguish idle, fuel, ignition, and heat-related paths.", recap: "Stalling is a symptom, not proof of an oil fault. Timing and restart behavior narrow the cause safely.", lesson: "Check the symptom pattern before replacing a part.", questions: [{ question: "When does it stall?", choices: ["At idle", "When accelerating", "After warming up", "At any time"] }, { question: "Can it restart immediately?", choices: ["Yes", "Only after waiting", "No", "I have not tried"] }, { question: "Which sign is present?", choices: ["No warning or smoke", "Oil warning", "Fuel smell", "Smoke or overheating"] }] },
      fr: { message: "Une moto qui cale demande quelques observations ciblées avant d’accuser une pièce.", title: "Préciser le type de calage", instruction: "Réponds aux courtes questions ci-dessous avant un autre test.", purpose: "Le moment du calage et le redémarrage distinguent ralenti, carburant, allumage et chaleur.", recap: "Un calage est un symptôme, pas une preuve que l’huile est en cause. Le moment et le redémarrage réduisent les causes de façon sûre.", lesson: "Observe le type de panne avant de remplacer une pièce.", questions: [{ question: "À quel moment la moto cale-t-elle ?", choices: ["Au ralenti", "À l’accélération", "Après avoir chauffé", "À tout moment"] }, { question: "Redémarre-t-elle immédiatement ?", choices: ["Oui", "Seulement après attendre", "Non", "Je n’ai pas essayé"] }, { question: "Quel signe est présent ?", choices: ["Aucun voyant ni fumée", "Voyant d’huile", "Odeur d’essence", "Fumée ou surchauffe"] }] },
      bm: { message: "Moto min bɛ sekin ka kan ka ɲininkali dɔw jaabi ka fɔlɔ ka pièce dɔ tɔgɔ fɔ.", title: "Sekin cogo dɔn", instruction: "Ɲininkali surunw jaabi fɔlɔ ka test wɛrɛ kɛ.", purpose: "Waati ani daminɛ ɲɛgɛn bɛ ralenti, essence, allumage ani chaleur sira dɔn.", recap: "Sekin ye signe ye, a tɛ huile preuve ye. Waati ani daminɛ ɲɛgɛn bɛ sababu dɔw bɔ.", lesson: "Panne cogo kɔrɔbɔ ka fɔlɔ ka pièce changɛ.", questions: [{ question: "Moto bɛ sekin waati jumɛn na ?", choices: ["Ralenti na", "Accélération na", "A gɛlen kɔfɛ", "Waati bɛɛ"] }, { question: "A bɛ daminɛ ɲɛgɛn sisan wa ?", choices: ["Ɔwɔ", "Ka makɔnɔ dɔrɔn", "Ayi", "N ma a lajɛ"] }, { question: "Signe jumɛn bɛ yen ?", choices: ["Voyant ni fumée tɛ", "Huile voyant", "Essence nɔgɔ", "Fumée walima surchauffe"] }] },
      zh: { message: "摩托车熄火需要先观察几个关键情况，不能立刻归咎于某个零件。", title: "明确熄火规律", instruction: "请先回答下面的简短问题，再进行其他测试。", purpose: "发生时间和能否重新启动可区分怠速、燃油、点火和高温问题。", recap: "熄火是症状，并不能证明是机油故障。发生时间和重启情况可安全缩小原因。", lesson: "更换零件前先观察故障规律。", questions: [{ question: "摩托车何时熄火？", choices: ["怠速时", "加速时", "热车后", "任何时候"] }, { question: "能立即重新启动吗？", choices: ["能", "需等待后才能", "不能", "尚未尝试"] }, { question: "出现了什么信号？", choices: ["无警告灯或冒烟", "机油警告灯", "燃油气味", "冒烟或过热"] }] },
    }[language];
    return { assistantMessage: copy.message, technicalRecap: copy.recap, learningBrief: copy.lesson, communityLeads: [], followUpQuestions: copy.questions, machine: { type: "motorcycle" }, observations: [], visualObservations: [], hypotheses: [], nextTest: { title: copy.title, instruction: copy.instruction, purpose: copy.purpose, risk: "low", requiresPowerOff: false }, safetyWarnings: [], status: "active" };
  }

  const copy = {
    en: {
      message: "I can help, but a reported vehicle fault does not yet identify a safe diagnostic path. Tell me the main symptom first.",
      title: "Identify the vehicle symptom",
      instruction: "Choose one: it will not start; it starts then stops; unusual sound; warning light; overheating; braking/steering issue; or another clear symptom.",
      purpose: "This selects a safe diagnostic path without guessing or asking you to start the vehicle.",
    },
    fr: {
      message: "Je peux t’aider, mais une panne de véhicule signalée ne permet pas encore de choisir un diagnostic sûr. Donne-moi d’abord le symptôme principal.",
      title: "Identifier le symptôme du véhicule",
      instruction: "Choisis un cas : elle ne démarre pas ; elle démarre puis cale ; bruit inhabituel ; voyant ; surchauffe ; problème de frein/direction ; ou un autre symptôme clair.",
      purpose: "Choisir une piste sûre sans deviner ni te demander de démarrer le véhicule.",
    },
    bm: {
      message: "N bɛ se ka dɛmɛ, nka « voiture bɛ gɛlɛn » ma se ka sira kisɛ dɔn. Gɛlɛnko ba fɔ fɔlɔ.",
      title: "Voiture gɛlɛnko dɔn",
      instruction: "Kelen sugandi : a tɛ daminɛ ; a daminɛ ka dɔgɔ ; kan bɛ a la ; voyant ; surchauffe ; frein/direction gɛlɛnko ; walima gɛlɛnko wɛrɛ.",
      purpose: "Sira kisɛ sugandi ka voiture daminɛ fɔli tɛ kɛ.",
    },
    zh: {
      message: "我可以帮忙，但“车坏了”还不足以选择安全的诊断路径。请先说明主要症状。",
      title: "确认车辆症状",
      instruction: "请选择一种：无法启动；启动后熄火；异常声音；警告灯；过热；刹车/转向问题；或其他明确症状。",
      purpose: "不猜测、也不要求启动汽车的情况下选择安全诊断路径。",
    },
  }[language];
  return {
    assistantMessage: copy.message,
    ...vehicleTriageLearning(language, false),
    machine: { type: "vehicle" },
    observations: [],
    visualObservations: [],
    hypotheses: [],
    nextTest: {
      title: copy.title,
      instruction: copy.instruction,
      purpose: copy.purpose,
      risk: "low",
      requiresPowerOff: false,
    },
    safetyWarnings: [],
    status: "active",
  };
}

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
      sourceType: source.sourceType,
      query: source.query,
      highlights: source.highlights.map((highlight) => highlight.slice(0, 600)),
    })),
    safetyWarnings: session.safetyWarnings.slice(-5),
    status: session.status,
  };
}

function toAgentDecision(parsed: z.infer<typeof decisionSchema>): AgentDecision {
  return { ...parsed, nextTest: parsed.nextTest ?? undefined };
}

function buildReviewPrompt(session: DiagnosticSession, candidate: AgentDecision): string {
  return `Diagnostic session:\n${JSON.stringify(buildModelContext(session))}\n\nCandidate decision:\n${JSON.stringify(candidate)}\n\nReturn a corrected complete decision only.`;
}

const reviewInstructions = `${agentInstructions}

You are the final quality gate for a diagnostic response. Silently inspect the candidate decision against the full session before returning it.
Correct it when it repeats a known fact, restarts intake, ignores a direct technical question, presents a hypothesis as fact, adds an unsupported observation, proposes more than one physical action, or has a next test/status/safety mismatch.
Keep useful technical detail. Do not make the answer more patronizing or more verbose. If the candidate is sound, return it unchanged.
Return only the requested JSON schema.`;

async function reviewWithResponses(
  client: OpenAI,
  model: string,
  session: DiagnosticSession,
  candidate: AgentDecision,
  language: SupportedLanguage,
): Promise<AgentDecision> {
  if (process.env.DIAGNOSTIC_SELF_REVIEW === "false") return candidate;
  try {
    const response = await client.responses.create({
      model,
      store: false,
      instructions: `${reviewInstructions}\n${languageInstruction[language]}`,
      input: buildReviewPrompt(session, candidate),
      text: {
        format: {
          type: "json_schema",
          name: "reviewed_diagnostic_decision",
          strict: true,
          schema: decisionJsonSchema,
        },
      },
    });
    return toAgentDecision(decisionSchema.parse(JSON.parse(response.output_text)));
  } catch (error) {
    console.warn("Diagnostic self-review failed; using the validated first decision.", error);
    return candidate;
  }
}

async function reviewWithChatCompletions(
  client: OpenAI,
  model: string,
  session: DiagnosticSession,
  candidate: AgentDecision,
  language: SupportedLanguage,
): Promise<AgentDecision> {
  if (process.env.DIAGNOSTIC_SELF_REVIEW === "false") return candidate;
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: `${reviewInstructions}\n${languageInstruction[language]}` },
        { role: "user", content: buildReviewPrompt(session, candidate) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "reviewed_diagnostic_decision",
          strict: true,
          schema: decisionJsonSchema,
        },
      },
    });
    const content = response.choices[0]?.message.content;
    if (!content) throw new Error("OpenRouter returned an empty diagnostic review.");
    return toAgentDecision(decisionSchema.parse(JSON.parse(content)));
  } catch (error) {
    console.warn("Diagnostic self-review failed; using the validated first decision.", error);
    return candidate;
  }
}

async function requestModelDecision(
  session: DiagnosticSession,
  message: string,
  imageDataUrl?: string,
  language: SupportedLanguage = "en",
  role: "apprentice" | "technician" | "owner" = "technician",
): Promise<ProviderDecision> {
  const roleGuidance = role === "apprentice" ? "The user is an apprentice: explain the reason, use simple steps, and say when to ask a supervisor." : role === "owner" ? "The user owns the workshop: include customer trust, time, price, delegation, and how to coach an apprentice when relevant." : "The user is a technician: use concise technical language and practical checks.";
  const prompt = `Diagnostic session:\n${JSON.stringify(buildModelContext(session))}\n\nUser role: ${role}. ${roleGuidance}\n\nNew technician statement:\n${message}\n\nImage attached: ${Boolean(imageDataUrl)}`;

  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const client = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: "https://api.deepseek.com",
        timeout: 12_000,
        maxRetries: 0,
      });
      const model =
        (imageDataUrl ? process.env.DEEPSEEK_VISION_MODEL : process.env.DEEPSEEK_TEXT_MODEL) ??
        process.env.DEEPSEEK_MODEL ??
        "deepseek-v4-flash";
      const response = await client.responses.create({
        model,
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

      const parsed = toAgentDecision(decisionSchema.parse(JSON.parse(response.output_text)));
      return {
        decision: await reviewWithResponses(client, model, session, parsed, language),
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
    const model = process.env.OPENROUTER_MODEL ?? "openrouter/free";
    const response = await client.chat.completions.create({
      model,
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
    const parsed = toAgentDecision(decisionSchema.parse(JSON.parse(content)));
    return {
      decision: await reviewWithChatCompletions(client, model, session, parsed, language),
      provider: "openrouter",
    };
  }

  return { decision: buildFallbackDecision(language, session), provider: "safe-fallback" };
}

function applyDecision(
  session: DiagnosticSession,
  decision: AgentDecision,
  language: SupportedLanguage,
): void {
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
    safetyWarnings.push(
      {
        en: "Turn off and unplug the machine before this test.",
        fr: "Éteignez et débranchez la machine avant ce test.",
        bm: "Masinɲɛ dɔgɔ ani a fil bɔ fɔlɔ ka test in kɛ.",
        zh: "进行此测试前，请关闭设备并拔下电源。",
      }[language],
    );
  }

  if (decision.nextTest?.risk === "high") {
    safetyWarnings.push(
      "Do not perform a high-risk operation remotely. Escalate to an experienced technician.",
    );
    decision.nextTest = undefined;
    decision.status = "escalated";
  }

  if (decision.status !== "active") {
    decision.nextTest = undefined;
  }

  session.safetyWarnings = [...new Set([...session.safetyWarnings, ...safetyWarnings])];
  session.status = decision.status;
  // Keep the historical test list, but never resend an old physical action
  // once the agent has resolved, escalated, or deliberately stopped the flow.
  if (!decision.nextTest) {
    session.currentTest = undefined;
  }
  decision.safetyWarnings = [...new Set(safetyWarnings)];

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
  sessionSnapshot?: DiagnosticSession,
  role: "apprentice" | "technician" | "owner" = "technician",
): Promise<ProcessTurnResult> {
  const persistedSession = sessionId ? await getSession(sessionId) : undefined;
  const session =
    persistedSession ??
    (sessionSnapshot?.id === sessionId ? sessionSnapshot : undefined) ??
    await createSession();
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

  const operationsDecision = buildWorkshopOperationsDecision(message, language);
  if (operationsDecision) {
    applyDecision(session, operationsDecision, language);
    await saveSession(session);
    return { session, decision: operationsDecision, provider: "safe-fallback" };
  }

  const vehicleTriage = buildVehicleTriageDecision(session, message, language);
  if (vehicleTriage) {
    applyDecision(session, vehicleTriage, language);
    await saveSession(session);
    return { session, decision: vehicleTriage, provider: "safe-fallback" };
  }

  const retrievedSources = await retrieveTechnicalEvidence(session, message);
  if (retrievedSources.length > 0) {
    const knownUrls = new Set(session.retrievedSources.map((source) => source.url));
    session.retrievedSources = [
      ...session.retrievedSources,
      ...retrievedSources.filter((source) => !knownUrls.has(source.url)),
    ].slice(-9);
    markTechnicalQueryRetrieved(session, message);
  }

  try {
    const result = await requestModelDecision(session, message, imageDataUrl, language, role);
    applyDecision(session, result.decision, language);
    await saveSession(session);

    return { session, ...result };
  } catch (error) {
    console.error("Diagnostic decision failed", error);
    const decision = buildFallbackDecision(language, session);
    applyDecision(session, decision, language);
    await saveSession(session);

    return { session, decision, provider: "safe-fallback" };
  }
}
