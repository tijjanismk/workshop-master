"use client";

import {
  AlertCircle,
  Camera,
  ExternalLink,
  Mic,
  PauseCircle,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Volume2,
  Wrench,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AgentDecision, DiagnosticSession } from "@/lib/diagnostics/types";

type Language = "en" | "fr" | "bm" | "zh";
type Provider = "deepseek" | "openrouter" | "safe-fallback";
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: { length: number; [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type RecognitionConstructor = new () => Recognition;
type ResponsePayload = { session: DiagnosticSession; decision: AgentDecision; provider: Provider };
type LearningEntry = { id: string; createdAt: string; machine: string; recap: string; lesson: string; status: DiagnosticSession["status"] };

const learningNotebookKey = "workshop-master-learning-notebook";

const speechLocale: Record<Language, string> = { en: "en-US", fr: "fr-FR", bm: "bm-ML", zh: "zh-CN" };
const examples: Record<Language, string> = {
  en: "Epson L3210. It says paper jam. I see no paper.",
  fr: "Epson L3210. Il dit bourrage papier. Je ne vois pas de papier.",
  bm: "Epson L3210. A bɛ papier jam fɔ. N tɛ papier ye.",
  zh: "Epson L3210 提示卡纸。我看不到纸。",
};
const labels: Record<Language, Record<string, string>> = {
  en: { workspace: "Diagnostic workspace", active: "Active diagnosis", next: "Next physical action", thinking: "The AI is thinking: context, sources, and safety…", technician: "Technician", agent: "AI observation", vision: "Visual fact", evidence: "Technical evidence", input: "Add evidence", send: "Analyze evidence", session: "New session", noTest: "Describe the problem to begin", noHypothesis: "No hypothesis yet", safety: "Safety", source: "Open source", photo: "Add photo", voice: "Speak", stop: "Stop", demo: "Load Epson demo", error: "The diagnostic request failed.", status: "Status", machine: "Machine" },
  fr: { workspace: "Espace de diagnostic", active: "Diagnostic en cours", next: "Prochaine action physique", thinking: "L’IA réfléchit : contexte, sources et sécurité…", technician: "Technicien", agent: "Observation IA", vision: "Fait visuel", evidence: "Sources techniques", input: "Ajouter une preuve", send: "Analyser l’observation", session: "Nouvelle session", noTest: "Décris le problème pour commencer", noHypothesis: "Aucune hypothèse pour le moment", safety: "Sécurité", source: "Ouvrir la source", photo: "Joindre une photo", voice: "Dicter", stop: "Arrêter", demo: "Charger la démo Epson", error: "La demande de diagnostic a échoué.", status: "État", machine: "Machine" },
  bm: { workspace: "Sɛgɛsɛgɛli baara yɔrɔ", active: "Sɛgɛsɛgɛli bɛ baara kɛ", next: "Kɛcogo nata", thinking: "IA bɛ miiri : kɔrɔbɔ, sebɛn ani kisɛ…", technician: "Baara kɛla", agent: "IA yeeliya", vision: "Nyɛ fɛn", evidence: "Tekiniki sebɛn", input: "Dɔnni fara", send: "Dɔnni sɛgɛsɛgɛ", session: "Sɛgɛsɛgɛli kura", noTest: "Gɛlɛnko fɔ ka daminɛ", noHypothesis: "Miiri tɛ fɔlɔ", safety: "Kisɛ", source: "Sebɛn da", photo: "Foto fara", voice: "Fɔ", stop: "Dɔgɔ", demo: "Epson misali don", error: "Sɛgɛsɛgɛli ma kɛ.", status: "Cogo", machine: "Masinɲɛ" },
  zh: { workspace: "诊断工作区", active: "诊断进行中", next: "下一步物理操作", thinking: "AI 正在深入分析：上下文、来源与安全…", technician: "技术员", agent: "AI 观察", vision: "视觉事实", evidence: "技术依据", input: "添加证据", send: "分析观察", session: "新建会话", noTest: "描述问题以开始", noHypothesis: "尚未形成假设", safety: "安全", source: "打开来源", photo: "添加照片", voice: "语音输入", stop: "停止", demo: "加载 Epson 演示", error: "诊断请求失败。", status: "状态", machine: "设备" },
};

const statusLabel: Record<Language, Record<string, string>> = {
  en: { active: "Active", resolved: "Resolved", escalated: "Escalated", low: "Low risk", medium: "Medium risk", high: "High risk" },
  fr: { active: "Actif", resolved: "Résolu", escalated: "À escalader", low: "Risque faible", medium: "Risque moyen", high: "Risque élevé" },
  bm: { active: "Bɛ baara kɛ", resolved: "A ban", escalated: "A ka taa ɲɛnamaya kɛla ma", low: "Juguya dɔgɔ", medium: "Juguya cɛma", high: "Juguya belebele" },
  zh: { active: "进行中", resolved: "已解决", escalated: "需升级处理", low: "低风险", medium: "中风险", high: "高风险" },
};
const workspaceText: Record<Language, { equipment: string; firstPrompt: string; report: string; manufacturer: string; model: string; hypotheses: string; timeline: string; timelineEmpty: string; sourcesEmpty: string }> = {
  en: { equipment: "Equipment", firstPrompt: "Provide the machine, main symptom, and any error code or visible signal.", report: "Report what you observed", manufacturer: "Manufacturer", model: "Model", hypotheses: "Current hypotheses", timeline: "Evidence timeline", timelineEmpty: "Evidence will appear here during the session.", sourcesEmpty: "Sources appear when a model or error code needs verification." },
  fr: { equipment: "Équipement", firstPrompt: "Indique la machine, le symptôme principal et tout code d’erreur ou signal visible.", report: "Décris ce que tu as observé", manufacturer: "Fabricant", model: "Modèle", hypotheses: "Hypothèses actuelles", timeline: "Chronologie des preuves", timelineEmpty: "Les preuves apparaîtront ici pendant le diagnostic.", sourcesEmpty: "Les sources apparaissent lorsqu’un modèle ou code d’erreur doit être vérifié." },
  bm: { equipment: "Masinɲɛ", firstPrompt: "Masinɲɛ, gɛlɛnko ba ani erreur code walima signe min bɛ ye fɔ.", report: "Fɛn min i y'a ye fɔ", manufacturer: "Masin kɛla", model: "Modele", hypotheses: "Miiri bɛ yen", timeline: "Dɔnni kɔrɔbɔ", timelineEmpty: "Dɔnni bɛna bɔ yan sɛgɛsɛgɛli kɔfɛ.", sourcesEmpty: "Sebɛn bɛna bɔ ni modele walima erreur code ka ɲɛnabɔ." },
  zh: { equipment: "设备", firstPrompt: "请提供设备、主要症状及任何错误代码或可见信号。", report: "描述你的观察结果", manufacturer: "制造商", model: "型号", hypotheses: "当前假设", timeline: "证据时间线", timelineEmpty: "诊断过程中证据会显示在这里。", sourcesEmpty: "当型号或错误代码需要验证时，来源会显示在这里。" },
};

type GuidedAnswer = "" | "cold" | "hot" | "after-use" | "idle" | "won't restart" | "restarts" | "warning" | "oil-warning" | "smoke" | "fuel-smell" | "none" | "unknown" | "motorcycle" | "car" | "machine" | "printer";
type GuidedAnswers = { equipment: GuidedAnswer; symptom: GuidedAnswer; timing: GuidedAnswer; restart: GuidedAnswer; safety: GuidedAnswer };

const orientationText: Record<Language, {
  title: string; description: string; equipment: string; symptom: string; timing: string; restart: string; safety: string; choose: string; apply: string; options: Record<Exclude<GuidedAnswer, "">, string>;
}> = {
  en: { title: "Guided questions", description: "Answer only what you know. These choices orient the first diagnosis.", equipment: "Equipment", symptom: "What happens?", timing: "When does it happen?", restart: "Can it restart?", safety: "Any safety sign?", choose: "Choose", apply: "Use these answers", options: { motorcycle: "Motorcycle", car: "Car", machine: "Machine", printer: "Printer", idle: "It stalls at idle", "won't restart": "It does not restart", restarts: "It restarts", cold: "When cold", hot: "When hot", "after-use": "After some use", warning: "Warning light", "oil-warning": "Oil warning", smoke: "Smoke or burning smell", "fuel-smell": "Fuel smell or leak", none: "None noticed", unknown: "I do not know" } },
  fr: { title: "Questions guidées", description: "Réponds seulement à ce que tu sais. Ces choix orientent le premier diagnostic.", equipment: "Équipement", symptom: "Que se passe-t-il ?", timing: "À quel moment ?", restart: "Peut-elle redémarrer ?", safety: "Signe de sécurité ?", choose: "Choisir", apply: "Utiliser ces réponses", options: { motorcycle: "Moto", car: "Voiture", machine: "Machine", printer: "Imprimante", idle: "Elle cale au ralenti", "won't restart": "Elle ne redémarre pas", restarts: "Elle redémarre", cold: "À froid", hot: "À chaud", "after-use": "Après quelques minutes", warning: "Voyant allumé", "oil-warning": "Voyant d'huile", smoke: "Fumée ou odeur de brûlé", "fuel-smell": "Odeur ou fuite d'essence", none: "Rien remarqué", unknown: "Je ne sais pas" } },
  bm: { title: "Ɲininkali min bɛ ɲɛsin", description: "Fɛn min i b'a dɔn dɔrɔn fɔ. Sugandiliw bɛ daminɛ sɛgɛsɛgɛli ɲɛnabɔ.", equipment: "Masinɲɛ", symptom: "Mun bɛ kɛ ?", timing: "Waati jumɛn na ?", restart: "A bɛ se ka daminɛ ɲɛgɛn ?", safety: "Kisɛ ka sɛbɛn bɛ yen wa ?", choose: "Sugandi", apply: "Nin jaabiw kɛ baara la", options: { motorcycle: "Moto", car: "Wotoro", machine: "Masin", printer: "Imprimante", idle: "A bɛ sekin ralenti na", "won't restart": "A tɛ daminɛ ɲɛgɛn", restarts: "A bɛ daminɛ ɲɛgɛn", cold: "N'a nɔgɔlen", hot: "N'a gɛlen", "after-use": "Dɔɔnin baara kɔfɛ", warning: "Voyant bɛ ye", "oil-warning": "Huile voyant", smoke: "Dunun walima tulu nɔgɔ", "fuel-smell": "Essence nɔgɔ walima bɔli", none: "Foyi ma ye", unknown: "N t'a dɔn" } },
  zh: { title: "引导问题", description: "只回答你知道的内容。这些选择会帮助 AI 确定首次诊断方向。", equipment: "设备", symptom: "发生了什么？", timing: "什么时候发生？", restart: "能重新启动吗？", safety: "有安全警示吗？", choose: "请选择", apply: "使用这些答案", options: { motorcycle: "摩托车", car: "汽车", machine: "机器", printer: "打印机", idle: "怠速时熄火", "won't restart": "无法重新启动", restarts: "可以重新启动", cold: "冷车时", hot: "热车时", "after-use": "使用一段时间后", warning: "警告灯亮", "oil-warning": "机油警告灯", smoke: "冒烟或烧焦味", "fuel-smell": "汽油味或泄漏", none: "未发现", unknown: "不知道" } },
};

const learningText: Record<Language, { recap: string; lesson: string; community: string; report: string; confirm: string }> = {
  en: { recap: "Technical recap", lesson: "Learn while diagnosing", community: "Community leads", report: "Community report", confirm: "Safe way to check" },
  fr: { recap: "Récapitulatif technique", lesson: "À retenir", community: "Pistes issues de la communauté", report: "Retour de communauté", confirm: "Vérification sûre" },
  bm: { recap: "Tekiniki kɔrɔbɔ", lesson: "Dɔnni min ka taa ɲɛ", community: "Jama ka sira fɔliw", report: "Jama ka fɔli", confirm: "Kɔrɔbɔ kisɛ" },
  zh: { recap: "技术小结", lesson: "诊断中的学习要点", community: "社区线索", report: "社区经验", confirm: "安全确认方法" },
};

const notebookText: Record<Language, { title: string; description: string; save: string; saved: string; empty: string; clear: string }> = {
  en: { title: "My learning notebook", description: "Save useful cases and lessons on this device.", save: "Save this case", saved: "Saved cases", empty: "Your useful cases will appear here.", clear: "Clear" },
  fr: { title: "Mon carnet d’apprentissage", description: "Enregistre les cas et leçons utiles sur cet appareil.", save: "Enregistrer ce cas", saved: "Cas enregistrés", empty: "Tes cas utiles apparaîtront ici.", clear: "Effacer" },
  bm: { title: "N ka dɔnni cahier", description: "Cas ani dɔnni nafama mara nin appareil na.", save: "Nin cas mara", saved: "Cas minnu mara", empty: "I ka cas nafamaw bɛna bɔ yan.", clear: "A bɔ" },
  zh: { title: "我的学习笔记", description: "在此设备上保存有用案例和经验。", save: "保存此案例", saved: "已保存案例", empty: "有用案例将显示在这里。", clear: "清除" },
};

const continuationText: Record<Language, { similar: string; similarEmpty: string; report: string; reportDescription: string; download: string }> = {
  en: { similar: "Related cases on this device", similarEmpty: "Save resolved cases to find them again when a similar problem returns.", report: "Escalate with a clear report", reportDescription: "Download the symptom, evidence, hypotheses, and current safe action for an experienced technician.", download: "Download report" },
  fr: { similar: "Cas similaires sur cet appareil", similarEmpty: "Enregistre les cas résolus pour les retrouver lorsqu’un problème semblable revient.", report: "Escalader avec un rapport clair", reportDescription: "Télécharge le symptôme, les preuves, les hypothèses et l’action sûre actuelle pour un technicien expérimenté.", download: "Télécharger le rapport" },
  bm: { similar: "Cas ɲɔgɔnnen nin appareil na", similarEmpty: "Cas minnu ban mara walasa ka se ka u ye tuguni ni gɛlɛnko ɲɔgɔnnen seginna.", report: "Rapɔri ɲuman ci expert ma", reportDescription: "Gɛlɛnko, dɔnni, miiri ani kɛcogo kisɛ télécharger ka ci technicien ma.", download: "Rapɔri télécharger" },
  zh: { similar: "此设备上的相似案例", similarEmpty: "保存已解决案例，以便相似问题再次出现时查找。", report: "使用清晰报告升级处理", reportDescription: "下载症状、证据、假设和当前安全操作，交给经验丰富的技术员。", download: "下载报告" },
};

const dynamicQuestionText: Record<Language, { title: string; description: string; choose: string; apply: string }> = {
  en: { title: "Questions for this problem", description: "These questions come from your reported symptom.", choose: "Choose", apply: "Use these answers" },
  fr: { title: "Questions pour ce problème", description: "Ces questions viennent du symptôme que tu as décrit.", choose: "Choisir", apply: "Utiliser ces réponses" },
  bm: { title: "Ɲininkaliw nin gɛlɛnko kan", description: "Ɲininkaliw bɛ bɔ gɛlɛnko min i y'a fɔ na.", choose: "Sugandi", apply: "Nin jaabiw kɛ baara la" },
  zh: { title: "针对该问题的问题", description: "这些问题来自你描述的症状。", choose: "请选择", apply: "使用这些答案" },
};

function GuidedOrientation({ language, onApply }: { language: Language; onApply: (summary: string) => void }) {
  const [answers, setAnswers] = useState<GuidedAnswers>({ equipment: "", symptom: "", timing: "", restart: "", safety: "" });
  const text = orientationText[language];
  const fields: Array<{ key: keyof GuidedAnswers; label: string; choices: GuidedAnswer[] }> = [
    { key: "equipment", label: text.equipment, choices: ["motorcycle", "car", "machine", "printer", "unknown"] },
    { key: "symptom", label: text.symptom, choices: ["idle", "won't restart", "restarts", "unknown"] },
    { key: "timing", label: text.timing, choices: ["cold", "hot", "after-use", "unknown"] },
    { key: "restart", label: text.restart, choices: ["restarts", "won't restart", "unknown"] },
    { key: "safety", label: text.safety, choices: ["oil-warning", "warning", "smoke", "fuel-smell", "none", "unknown"] },
  ];
  const summary = fields.map(({ key, label }) => answers[key] ? `${label}: ${text.options[answers[key] as Exclude<GuidedAnswer, "">]}` : "").filter(Boolean).join(". ");

  return <Card className="border-zinc-200 bg-white"><CardHeader className="pb-3"><CardDescription>{text.title}</CardDescription><CardTitle className="mt-1 text-lg">{text.description}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-zinc-700">{fields[0].label}<select value={answers.equipment} onChange={(event) => setAnswers((value) => ({ ...value, equipment: event.target.value as GuidedAnswer }))} className="mt-1.5 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"><option value="">{text.choose}</option>{fields[0].choices.map((choice) => <option key={choice} value={choice}>{text.options[choice as Exclude<GuidedAnswer, "">]}</option>)}</select></label><label className="text-sm font-medium text-zinc-700">{fields[1].label}<select value={answers.symptom} onChange={(event) => setAnswers((value) => ({ ...value, symptom: event.target.value as GuidedAnswer }))} className="mt-1.5 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"><option value="">{text.choose}</option>{fields[1].choices.map((choice) => <option key={choice} value={choice}>{text.options[choice as Exclude<GuidedAnswer, "">]}</option>)}</select></label><label className="text-sm font-medium text-zinc-700">{fields[2].label}<select value={answers.timing} onChange={(event) => setAnswers((value) => ({ ...value, timing: event.target.value as GuidedAnswer }))} className="mt-1.5 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"><option value="">{text.choose}</option>{fields[2].choices.map((choice) => <option key={choice} value={choice}>{text.options[choice as Exclude<GuidedAnswer, "">]}</option>)}</select></label><label className="text-sm font-medium text-zinc-700">{fields[3].label}<select value={answers.restart} onChange={(event) => setAnswers((value) => ({ ...value, restart: event.target.value as GuidedAnswer }))} className="mt-1.5 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"><option value="">{text.choose}</option>{fields[3].choices.map((choice) => <option key={choice} value={choice}>{text.options[choice as Exclude<GuidedAnswer, "">]}</option>)}</select></label><label className="text-sm font-medium text-zinc-700 sm:col-span-2">{fields[4].label}<select value={answers.safety} onChange={(event) => setAnswers((value) => ({ ...value, safety: event.target.value as GuidedAnswer }))} className="mt-1.5 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"><option value="">{text.choose}</option>{fields[4].choices.map((choice) => <option key={choice} value={choice}>{text.options[choice as Exclude<GuidedAnswer, "">]}</option>)}</select></label></div><Button type="button" size="sm" disabled={!summary} onClick={() => onApply(summary)}>{text.apply}</Button></CardContent></Card>;
}

function DynamicQuestions({ decision, language, onApply }: { decision?: AgentDecision; language: Language; onApply: (summary: string) => void }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const questions = decision?.followUpQuestions ?? [];
  const text = dynamicQuestionText[language];
  if (!questions.length) return null;
  const summary = questions.map((question, index) => answers[index] ? `${question.question}: ${answers[index]}` : "").filter(Boolean).join(". ");
  return <Card className="border-zinc-300 bg-white"><CardHeader className="pb-3"><CardDescription>{text.title}</CardDescription><CardTitle className="mt-1 text-lg">{text.description}</CardTitle></CardHeader><CardContent className="space-y-3">{questions.map((question, index) => <label key={question.question} className="block text-sm font-medium text-zinc-700">{question.question}<select value={answers[index] ?? ""} onChange={(event) => setAnswers((value) => ({ ...value, [index]: event.target.value }))} className="mt-1.5 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"><option value="">{text.choose}</option>{question.choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select></label>)}<Button type="button" size="sm" disabled={!summary} onClick={() => onApply(summary)}>{text.apply}</Button></CardContent></Card>;
}

function DecisionLearning({ decision, language }: { decision?: AgentDecision; language: Language }) {
  if (!decision || (!decision.technicalRecap && !decision.learningBrief && !decision.communityLeads?.length)) return null;
  const text = learningText[language];
  return <div className="grid gap-4 md:grid-cols-2">{decision.technicalRecap && <Card><CardHeader className="pb-2"><CardDescription>{text.recap}</CardDescription></CardHeader><CardContent><p className="text-sm leading-6 text-zinc-700">{decision.technicalRecap}</p></CardContent></Card>}{decision.learningBrief && <Card><CardHeader className="pb-2"><CardDescription>{text.lesson}</CardDescription></CardHeader><CardContent><p className="text-sm leading-6 text-zinc-700">{decision.learningBrief}</p></CardContent></Card>}{decision.communityLeads?.length ? <Card className="border-amber-300/60 md:col-span-2"><CardHeader className="pb-2"><CardDescription>{text.community}</CardDescription></CardHeader><CardContent className="space-y-3">{decision.communityLeads.map((lead) => <div key={`${lead.sourceTitle}-${lead.insight}`} className="border-l-2 border-amber-400 pl-3"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{text.report} · {lead.sourceTitle}</p><p className="mt-1 text-sm leading-6 text-zinc-800">{lead.insight}</p><p className="mt-1 text-sm leading-6 text-zinc-600"><span className="font-medium text-zinc-800">{text.confirm}:</span> {lead.safeConfirmation}</p></div>)}</CardContent></Card> : null}</div>;
}

function CustomerReply({ decision, language }: { decision?: AgentDecision; language: Language }) {
  const customerReply = decision?.customerReply;
  if (!customerReply) return null;
  const title: Record<Language, string> = { en: "Message ready for the customer", fr: "Message prêt pour le client", bm: "Client ka message labɛnna", zh: "可直接发送给客户的消息" };
  const copy: Record<Language, string> = { en: "Copy", fr: "Copier", bm: "Copier", zh: "复制" };
  return <Card className="border-amber-300/60 bg-amber-50"><CardHeader className="pb-2"><CardDescription>{title[language]}</CardDescription></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><p className="text-sm leading-6 text-zinc-800">“{customerReply}”</p><Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(customerReply)}>{copy[language]}</Button></CardContent></Card>;
}

function LearningNotebook({ decision, session, language }: { decision?: AgentDecision; session?: DiagnosticSession; language: Language }) {
  const [entries, setEntries] = useState<LearningEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem(learningNotebookKey) ?? "[]") as LearningEntry[];
    } catch {
      return [];
    }
  });
  const text = notebookText[language];
  function persist(nextEntries: LearningEntry[]) {
    setEntries(nextEntries);
    window.localStorage.setItem(learningNotebookKey, JSON.stringify(nextEntries));
  }
  function saveCurrentCase() {
    if (!decision || !session || (!decision.technicalRecap && !decision.learningBrief)) return;
    const entry: LearningEntry = {
      id: `${session.id}-${session.updatedAt}`,
      createdAt: new Date().toISOString(),
      machine: [session.machine.manufacturer, session.machine.model, session.machine.type].filter(Boolean).join(" ") || "Equipment",
      recap: decision.technicalRecap ?? decision.assistantMessage,
      lesson: decision.learningBrief ?? "",
      status: session.status,
    };
    persist([entry, ...entries.filter((item) => item.id !== entry.id)].slice(0, 12));
  }
  return <Card><CardHeader className="pb-3"><CardDescription>{text.title}</CardDescription><CardTitle className="mt-1 text-base">{text.description}</CardTitle></CardHeader><CardContent className="space-y-3">{decision && session ? <Button size="sm" variant="outline" onClick={saveCurrentCase}>{text.save}</Button> : null}{entries.length ? <><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{text.saved}</p><ul className="space-y-3">{entries.slice(0, 3).map((entry) => <li key={entry.id} className="border-l-2 border-zinc-300 pl-3"><p className="text-sm font-medium text-zinc-800">{entry.machine}</p><p className="mt-1 text-xs leading-5 text-zinc-600">{entry.lesson || entry.recap}</p></li>)}</ul><Button size="sm" variant="ghost" onClick={() => persist([])}>{text.clear}</Button></> : <Empty>{text.empty}</Empty>}</CardContent></Card>;
}

function LocalSimilarCases({ session, language }: { session?: DiagnosticSession; language: Language }) {
  const text = continuationText[language];
  const [entries] = useState<LearningEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(window.localStorage.getItem(learningNotebookKey) ?? "[]") as LearningEntry[]; } catch { return []; }
  });
  if (!session) return null;
  const terms = new Set(`${session.machine.type ?? ""} ${session.symptoms.join(" ")}`.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []);
  const matches = entries.filter((entry) => [...terms].some((term) => `${entry.machine} ${entry.recap} ${entry.lesson}`.toLowerCase().includes(term))).slice(0, 3);
  return <ContextCard title={text.similar}>{matches.length ? <ul className="space-y-3">{matches.map((entry) => <li key={entry.id} className="border-l-2 border-zinc-300 pl-3"><p className="text-sm font-medium text-zinc-800">{entry.machine}</p><p className="mt-1 text-xs leading-5 text-zinc-600">{entry.lesson || entry.recap}</p></li>)}</ul> : <Empty>{text.similarEmpty}</Empty>}</ContextCard>;
}

function EscalationReport({ session, decision, language }: { session?: DiagnosticSession; decision?: AgentDecision; language: Language }) {
  const text = continuationText[language];
  if (!session || !decision) return null;
  const activeSession = session;
  const activeDecision = decision;
  function download() {
    const report = [
      "THE WORKSHOP MASTER — DIAGNOSTIC REPORT",
      `Generated: ${new Date().toLocaleString()}`,
      `Equipment: ${[activeSession.machine.manufacturer, activeSession.machine.model, activeSession.machine.type].filter(Boolean).join(" ") || "Unknown"}`,
      `Status: ${activeSession.status}`,
      `Reported symptoms: ${activeSession.symptoms.join(" | ") || "None"}`,
      `Observations: ${activeSession.observations.map((item) => item.text).join(" | ") || "None"}`,
      `Hypotheses: ${activeSession.hypotheses.map((item) => `${item.title} (${item.confidence})`).join(" | ") || "None"}`,
      `Technical recap: ${activeDecision.technicalRecap ?? "None"}`,
      `Current safe action: ${activeSession.currentTest?.instruction ?? "No active test"}`,
      `Safety warnings: ${activeSession.safetyWarnings.join(" | ") || "None"}`,
    ].join("\n\n");
    const url = URL.createObjectURL(new Blob([report], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `workshop-master-${activeSession.id}.txt`; anchor.click(); URL.revokeObjectURL(url);
  }
  return <Card><CardHeader className="pb-3"><CardDescription>{text.report}</CardDescription><CardTitle className="mt-1 text-base">{text.reportDescription}</CardTitle></CardHeader><CardContent><Button size="sm" variant="outline" onClick={download}>{text.download}</Button></CardContent></Card>;
}

export function WorkshopDashboard() {
  const [language, setLanguage] = useState<Language>("fr");
  const [message, setMessage] = useState("");
  const [image, setImage] = useState<string>();
  const [imageName, setImageName] = useState<string>();
  const [sessionId, setSessionId] = useState<string | undefined>(() =>
    typeof window === "undefined" ? undefined : window.localStorage.getItem("workshop-master-session") ?? undefined,
  );
  const [session, setSession] = useState<DiagnosticSession>();
  const [decision, setDecision] = useState<AgentDecision>();
  const [provider, setProvider] = useState<Provider>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const copy = labels[language];
  const workspace = workspaceText[language];
  const currentTest = session?.currentTest;

  function startVoice() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const browser = window as Window & typeof globalThis & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) {
      setError("Voice input is not supported by this browser. Please type the observation.");
      return;
    }
    const instance = new Constructor();
    instance.lang = speechLocale[language];
    instance.interimResults = false;
    instance.continuous = false;
    instance.onresult = (event) => {
      const text = Array.from({ length: event.results.length - event.resultIndex }, (_, index) => event.results[event.resultIndex + index][0].transcript).join(" ");
      setMessage((value) => `${value} ${text}`.trim());
    };
    instance.onerror = () => setError("Voice input could not be transcribed. Please try again or type the observation.");
    instance.onend = () => setListening(false);
    recognition.current = instance;
    setListening(true);
    instance.start();
  }

  function readResponse() {
    if (!decision || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(decision.assistantMessage);
    utterance.lang = speechLocale[language];
    window.speechSynthesis.speak(utterance);
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp|gif)$/)) {
      setError("Choose a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose an image smaller than 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setImage(reader.result as string); setImageName(file.name); setError(undefined); };
    reader.onerror = () => setError("The selected image could not be read.");
    reader.readAsDataURL(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim() || (image ? "Please analyze the attached image." : "");
    if (!text || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch("/api/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, sessionSnapshot: session, imageDataUrl: image, language }),
      });
      const result = await response.json() as ResponsePayload | { error: string };
      if (!response.ok || !("session" in result)) throw new Error("error" in result ? result.error : copy.error);
      setSession(result.session);
      setDecision(result.decision);
      setProvider(result.provider);
      setSessionId(result.session.id);
      window.localStorage.setItem("workshop-master-session", result.session.id);
      setMessage("");
      setImage(undefined);
      setImageName(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.error);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    window.localStorage.removeItem("workshop-master-session");
    setSessionId(undefined); setSession(undefined); setDecision(undefined); setProvider(undefined); setMessage(""); setImage(undefined); setImageName(undefined); setError(undefined);
  }

  const machineName = [session?.machine.manufacturer, session?.machine.model].filter(Boolean).join(" ") || copy.machine;
  const severity = currentTest?.risk === "high" ? "danger" : currentTest?.risk === "medium" ? "warning" : "success";

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-stone-50/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-lg border border-zinc-300 bg-zinc-100 text-zinc-600"><Wrench size={20} /></div><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">The Workshop Master</p><h1 className="text-sm text-zinc-700">An AI mentor for technicians and apprentices</h1></div></div>
          <div className="flex items-center gap-2"><Badge variant={session?.status === "escalated" ? "danger" : session?.status === "resolved" ? "success" : "default"}>{session ? statusLabel[language][session.status] : copy.active}</Badge><select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"><option value="fr">Français</option><option value="en">English</option><option value="zh">中文</option><option value="bm">Bamanankan · beta</option></select><Button variant="outline" size="sm" onClick={reset}><RotateCcw size={14} />{copy.session}</Button></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.65fr)_20rem] lg:px-8">
        <section className="space-y-5">
          {session ? <>{decision?.followUpQuestions?.length ? <DynamicQuestions key={decision.assistantMessage} decision={decision} language={language} onApply={setMessage} /> : <GuidedOrientation language={language} onApply={setMessage} />}</> : null}
          <DecisionLearning decision={decision} language={language} />
          <CustomerReply decision={decision} language={language} />
          <Card className="border-zinc-200 bg-white"><CardHeader className="border-b border-zinc-200"><div className="flex items-start justify-between gap-3"><div><CardDescription>{copy.workspace}</CardDescription><CardTitle className="mt-1 text-xl sm:text-2xl">{machineName}</CardTitle><p className="mt-2 text-sm text-zinc-500">{session?.machine.type || workspace.equipment} · {session ? statusLabel[language][session.status] : copy.active}</p></div><Badge variant="outline">{provider ?? "ready"}</Badge></div></CardHeader></Card>

          <Card className="border-zinc-300 bg-white shadow-lg shadow-zinc-200/30"><CardHeader><div className="flex items-start justify-between gap-4"><div><CardDescription className="font-semibold uppercase tracking-[0.16em] text-zinc-600">{copy.next}</CardDescription><CardTitle className="mt-2 text-xl">{currentTest?.title ?? copy.noTest}</CardTitle></div>{currentTest && <Badge variant={severity}>{statusLabel[language][currentTest.risk]}</Badge>}</div></CardHeader><CardContent className="space-y-4"><p className="text-base leading-7 text-zinc-950">{currentTest?.instruction ?? workspace.firstPrompt}</p>{currentTest?.purpose && <p className="border-l-2 border-zinc-300 pl-3 text-sm leading-6 text-zinc-500">{currentTest.purpose}</p>}{currentTest?.requiresPowerOff && <Alert className="border-amber-400/30 bg-amber-400/10 text-amber-100"><ShieldAlert className="mb-2 h-4 w-4" /><AlertTitle>{copy.safety}</AlertTitle><AlertDescription>Turn off and unplug the equipment before this test.</AlertDescription></Alert>}</CardContent></Card>

          {busy && <Alert className="border-zinc-300 bg-zinc-100 text-zinc-800"><Sparkles className="mb-2 h-4 w-4 animate-pulse" /><AlertTitle>{copy.thinking}</AlertTitle><AlertDescription>The response is checked against prior evidence before it is sent.</AlertDescription></Alert>}

          {decision && <Card><CardHeader className="flex-row items-center justify-between space-y-0"><div><CardDescription>{copy.agent}</CardDescription><CardTitle className="mt-1">Diagnostic update</CardTitle></div><Button variant="ghost" size="icon" aria-label="Read response aloud" onClick={readResponse}><Volume2 size={18} /></Button></CardHeader><CardContent><p className="whitespace-pre-wrap leading-7 text-zinc-800">{decision.assistantMessage}</p></CardContent></Card>}

          <Card><CardHeader><CardDescription>{copy.input}</CardDescription><CardTitle className="mt-1">{workspace.report}</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><Textarea aria-label="Technician observation" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Example: The sensor lever returns freely, but paper still stops before printing." disabled={busy} /><div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={startVoice} disabled={busy}>{listening ? <PauseCircle size={15} /> : <Mic size={15} />}{listening ? copy.stop : copy.voice}</Button><label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-zinc-300 px-3 text-xs font-medium text-zinc-800 hover:border-zinc-500"><Camera size={15} />{copy.photo}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={chooseImage} disabled={busy} /></label>{imageName && <Badge variant="outline">{imageName}<button className="ml-2 text-zinc-500 hover:text-zinc-950" type="button" onClick={() => { setImage(undefined); setImageName(undefined); }}>×</button></Badge>}</div>{error && <Alert className="border-rose-400/30 bg-rose-400/10 text-rose-100"><AlertCircle className="mb-2 h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}<div className="flex flex-col-reverse justify-between gap-3 sm:flex-row"><Button type="button" variant="ghost" size="sm" onClick={() => setMessage(examples[language])}>{copy.demo}</Button><Button type="submit" disabled={busy || (!message.trim() && !image)}>{busy ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Send size={15} />}{copy.send}</Button></div></form></CardContent></Card>
        </section>

        <aside className="space-y-5">
          <LearningNotebook decision={decision} session={session} language={language} />
          <LocalSimilarCases session={session} language={language} />
          <EscalationReport session={session} decision={decision} language={language} />
          <ContextCard title={copy.machine}><dl className="space-y-3 text-sm"><Info label={workspace.manufacturer} value={session?.machine.manufacturer || "—"} /><Info label={workspace.model} value={session?.machine.model || "—"} /><Info label={copy.status} value={session ? statusLabel[language][session.status] : "—"} /></dl></ContextCard>
          <ContextCard title={workspace.hypotheses}>{session?.hypotheses.length ? <div className="space-y-3">{session.hypotheses.map((hypothesis) => <div key={hypothesis.id} className="border-l-2 border-zinc-400 pl-3"><p className="text-sm font-medium">{hypothesis.title}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{hypothesis.rationale}</p><Badge className="mt-2" variant="outline">{hypothesis.confidence}</Badge></div>)}</div> : <Empty>{copy.noHypothesis}</Empty>}</ContextCard>
          {session?.safetyWarnings.length ? <ContextCard title={copy.safety} warning><ul className="space-y-2 text-sm text-amber-100">{session.safetyWarnings.slice(-3).map((warning) => <li key={warning}>• {warning}</li>)}</ul></ContextCard> : null}
          <ContextCard title={workspace.timeline}>{session?.observations.length ? <ol className="space-y-3 border-l border-zinc-300 pl-4">{session.observations.slice(-6).reverse().map((observation) => <li key={observation.id} className="relative text-sm"><span className="absolute -left-[1.35rem] top-1 h-2 w-2 rounded-full bg-zinc-400" /><p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{copy[observation.source] ?? observation.source}</p><p className="mt-1 leading-5 text-zinc-700">{observation.text}</p></li>)}</ol> : <Empty>{workspace.timelineEmpty}</Empty>}</ContextCard>
          <ContextCard title={copy.evidence}>{session?.retrievedSources?.length ? <ul className="space-y-3">{session.retrievedSources.slice(-4).map((source) => <li key={source.url}><Badge variant="outline">{source.sourceType}</Badge><a className="mt-1 flex items-start gap-1 text-sm leading-5 text-zinc-600 hover:text-zinc-700" href={source.url} target="_blank" rel="noreferrer">{source.title}<ExternalLink className="mt-0.5 h-3 w-3 shrink-0" /></a></li>)}</ul> : <Empty>{workspace.sourcesEmpty}</Empty>}</ContextCard>
        </aside>
      </div>
    </main>
  );
}
function ContextCard({ title, warning, children }: { title: string; warning?: boolean; children: React.ReactNode }) {
  return <Card className={warning ? "border-amber-400/30" : undefined}><CardHeader className="pb-3"><CardTitle className={`text-xs font-semibold uppercase tracking-[0.14em] ${warning ? "text-amber-200" : "text-zinc-600"}`}>{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3"><dt className="text-zinc-500">{label}</dt><dd className="text-right text-zinc-800">{value}</dd></div>; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="text-sm leading-6 text-zinc-500">{children}</p>; }
