"use client";

import { FormEvent, useState } from "react";

type Message = { author: "user" | "assistant"; text: string };

export default function WhatsAppDemoPage() {
  const [messages, setMessages] = useState<Message[]>([
    { author: "assistant", text: "Bonjour. Décris simplement ce que tu vois ou entends. Je te donne une seule chose sûre à vérifier." },
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    setMessages((current) => [...current, { author: "user", text: message }]);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("/api/channels/whatsapp-simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId, language: "fr" }),
      });
      const result = (await response.json()) as { sessionId: string; reply: string; nextTest?: string };
      if (!response.ok) throw new Error("La réponse n’est pas disponible.");
      setSessionId(result.sessionId);
      setMessages((current) => [
        ...current,
        { author: "assistant", text: result.nextTest ? `${result.reply}\n\nProchaine vérification : ${result.nextTest}` : result.reply },
      ]);
    } catch {
      setMessages((current) => [...current, { author: "assistant", text: "Je n’arrive pas à répondre maintenant. Réessaie dans un instant." }]);
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-[#f8f8f6] px-4 py-8 text-zinc-950"><section className="mx-auto max-w-md overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50"><header className="flex items-center gap-3 bg-white px-5 py-4"><span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500 font-bold text-slate-950">WM</span><div><h1 className="font-semibold">Workshop Master</h1><p className="text-xs text-zinc-500">Simulation WhatsApp · diagnostic sûr</p></div></header><div className="min-h-[52vh] space-y-3 bg-[radial-gradient(circle_at_20%_20%,rgba(24,24,27,.04),transparent_30%)] p-4">{messages.map((message, index) => <p key={index} className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow ${message.author === "user" ? "ml-auto rounded-br-sm bg-zinc-900 text-white" : "rounded-bl-sm bg-white"}`}>{message.text}</p>)}{busy && <p className="w-fit rounded-2xl bg-white px-4 py-3 text-sm text-zinc-500">Le mécanicien réfléchit…</p>}</div><form className="flex gap-2 border-t border-zinc-300 bg-white p-3" onSubmit={send}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ex. : La voiture fait un clic." className="min-w-0 flex-1 rounded-full bg-zinc-100 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-zinc-900" disabled={busy}/><button className="rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:bg-zinc-300" disabled={busy || !input.trim()} type="submit">Envoyer</button></form></section><p className="mx-auto mt-4 max-w-md text-center text-xs leading-5 text-zinc-500">Démo locale : aucune conversation WhatsApp réelle n’est envoyée. Même moteur de diagnostic, même mémoire de session.</p></main>;
}
