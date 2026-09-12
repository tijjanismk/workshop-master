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
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-lg border border-sky-400/30 bg-sky-400/10 text-sky-300"><Wrench size={20} /></div><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">The Workshop Master</p><h1 className="text-sm text-slate-300">An AI mentor for technicians and apprentices</h1></div></div>
          <div className="flex items-center gap-2"><Badge variant={session?.status === "escalated" ? "danger" : session?.status === "resolved" ? "success" : "default"}>{session ? statusLabel[language][session.status] : copy.active}</Badge><select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"><option value="fr">Français</option><option value="en">English</option><option value="zh">中文</option><option value="bm">Bamanankan · beta</option></select><Button variant="outline" size="sm" onClick={reset}><RotateCcw size={14} />{copy.session}</Button></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.65fr)_20rem] lg:px-8">
        <section className="space-y-5">
          <Card className="border-sky-400/20 bg-slate-900"><CardHeader className="border-b border-slate-800"><div className="flex items-start justify-between gap-3"><div><CardDescription>{copy.workspace}</CardDescription><CardTitle className="mt-1 text-xl sm:text-2xl">{machineName}</CardTitle><p className="mt-2 text-sm text-slate-400">{session?.machine.type || "Equipment"} · {session ? statusLabel[language][session.status] : copy.active}</p></div><Badge variant="outline">{provider ?? "ready"}</Badge></div></CardHeader></Card>

          <Card className="border-sky-400/40 bg-slate-900 shadow-lg shadow-sky-950/30"><CardHeader><div className="flex items-start justify-between gap-4"><div><CardDescription className="font-semibold uppercase tracking-[0.16em] text-sky-300">{copy.next}</CardDescription><CardTitle className="mt-2 text-xl">{currentTest?.title ?? copy.noTest}</CardTitle></div>{currentTest && <Badge variant={severity}>{statusLabel[language][currentTest.risk]}</Badge>}</div></CardHeader><CardContent className="space-y-4"><p className="text-base leading-7 text-slate-100">{currentTest?.instruction ?? "Provide the machine, main symptom, and any error code or visible signal."}</p>{currentTest?.purpose && <p className="border-l-2 border-slate-700 pl-3 text-sm leading-6 text-slate-400">{currentTest.purpose}</p>}{currentTest?.requiresPowerOff && <Alert className="border-amber-400/30 bg-amber-400/10 text-amber-100"><ShieldAlert className="mb-2 h-4 w-4" /><AlertTitle>{copy.safety}</AlertTitle><AlertDescription>Turn off and unplug the equipment before this test.</AlertDescription></Alert>}</CardContent></Card>

          {busy && <Alert className="border-sky-400/30 bg-sky-400/10 text-sky-100"><Sparkles className="mb-2 h-4 w-4 animate-pulse" /><AlertTitle>{copy.thinking}</AlertTitle><AlertDescription>The response is checked against prior evidence before it is sent.</AlertDescription></Alert>}

          {decision && <Card><CardHeader className="flex-row items-center justify-between space-y-0"><div><CardDescription>{copy.agent}</CardDescription><CardTitle className="mt-1">Diagnostic update</CardTitle></div><Button variant="ghost" size="icon" aria-label="Read response aloud" onClick={readResponse}><Volume2 size={18} /></Button></CardHeader><CardContent><p className="whitespace-pre-wrap leading-7 text-slate-200">{decision.assistantMessage}</p></CardContent></Card>}

          <Card><CardHeader><CardDescription>{copy.input}</CardDescription><CardTitle className="mt-1">Report what you observed</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><Textarea aria-label="Technician observation" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Example: The sensor lever returns freely, but paper still stops before printing." disabled={busy} /><div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={startVoice} disabled={busy}>{listening ? <PauseCircle size={15} /> : <Mic size={15} />}{listening ? copy.stop : copy.voice}</Button><label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-slate-700 px-3 text-xs font-medium text-slate-200 hover:border-sky-400"><Camera size={15} />{copy.photo}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={chooseImage} disabled={busy} /></label>{imageName && <Badge variant="outline">{imageName}<button className="ml-2 text-slate-400 hover:text-white" type="button" onClick={() => { setImage(undefined); setImageName(undefined); }}>×</button></Badge>}</div>{error && <Alert className="border-rose-400/30 bg-rose-400/10 text-rose-100"><AlertCircle className="mb-2 h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}<div className="flex flex-col-reverse justify-between gap-3 sm:flex-row"><Button type="button" variant="ghost" size="sm" onClick={() => setMessage(examples[language])}>{copy.demo}</Button><Button type="submit" disabled={busy || (!message.trim() && !image)}>{busy ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Send size={15} />}{copy.send}</Button></div></form></CardContent></Card>
        </section>

        <aside className="space-y-5">
          <ContextCard title={copy.machine}><dl className="space-y-3 text-sm"><Info label="Manufacturer" value={session?.machine.manufacturer || "—"} /><Info label="Model" value={session?.machine.model || "—"} /><Info label={copy.status} value={session ? statusLabel[language][session.status] : "—"} /></dl></ContextCard>
          <ContextCard title="Current hypotheses">{session?.hypotheses.length ? <div className="space-y-3">{session.hypotheses.map((hypothesis) => <div key={hypothesis.id} className="border-l-2 border-sky-400/50 pl-3"><p className="text-sm font-medium">{hypothesis.title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{hypothesis.rationale}</p><Badge className="mt-2" variant="outline">{hypothesis.confidence}</Badge></div>)}</div> : <Empty>{copy.noHypothesis}</Empty>}</ContextCard>
          {session?.safetyWarnings.length ? <ContextCard title={copy.safety} warning><ul className="space-y-2 text-sm text-amber-100">{session.safetyWarnings.slice(-3).map((warning) => <li key={warning}>• {warning}</li>)}</ul></ContextCard> : null}
          <ContextCard title="Evidence timeline">{session?.observations.length ? <ol className="space-y-3 border-l border-slate-700 pl-4">{session.observations.slice(-6).reverse().map((observation) => <li key={observation.id} className="relative text-sm"><span className="absolute -left-[1.35rem] top-1 h-2 w-2 rounded-full bg-slate-500" /><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{copy[observation.source] ?? observation.source}</p><p className="mt-1 leading-5 text-slate-300">{observation.text}</p></li>)}</ol> : <Empty>Evidence will appear here during the session.</Empty>}</ContextCard>
          <ContextCard title={copy.evidence}>{session?.retrievedSources?.length ? <ul className="space-y-3">{session.retrievedSources.slice(-4).map((source) => <li key={source.url}><Badge variant="outline">{source.sourceType}</Badge><a className="mt-1 flex items-start gap-1 text-sm leading-5 text-sky-300 hover:text-sky-200" href={source.url} target="_blank" rel="noreferrer">{source.title}<ExternalLink className="mt-0.5 h-3 w-3 shrink-0" /></a></li>)}</ul> : <Empty>Sources appear when a model or error code needs verification.</Empty>}</ContextCard>
        </aside>
      </div>
    </main>
  );
}

function ContextCard({ title, warning, children }: { title: string; warning?: boolean; children: React.ReactNode }) {
  return <Card className={warning ? "border-amber-400/30" : undefined}><CardHeader className="pb-3"><CardTitle className={`text-xs font-semibold uppercase tracking-[0.14em] ${warning ? "text-amber-200" : "text-sky-300"}`}>{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="text-right text-slate-200">{value}</dd></div>; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="text-sm leading-6 text-slate-500">{children}</p>; }
