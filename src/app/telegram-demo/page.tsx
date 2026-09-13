"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Step = 0 | 1 | 2;

export default function TelegramDemoPage() {
  const [step, setStep] = useState<Step>(0);
  const [device, setDevice] = useState<"iphone" | "android">("iphone");

  const advance = () => setStep((current) => Math.min(2, current + 1) as Step);
  const reset = () => setStep(0);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f8f6] px-4 py-8 text-zinc-950 sm:px-6 lg:px-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_5%,rgba(14,165,233,.22),transparent_30%),radial-gradient(circle_at_82%_72%,rgba(37,99,235,.2),transparent_32%)]" />
      <section className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_420px]">
        <div className="max-w-2xl">
          <Badge>LIVE DEMO FLOW</Badge>
          <p className="mt-5 text-sm font-semibold tracking-[.2em] text-zinc-700 uppercase">Telegram channel simulation</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">A real diagnostic conversation, inside the phone.</h1>
          <p className="mt-5 text-lg leading-8 text-zinc-700">The Workshop Master remembers what the technician said, gives one safe action, and uses technical sources before moving forward.</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={advance}>{step === 0 ? "Start Telegram demo" : step === 1 ? "Send the test result" : "Demo completed"}</Button>
            <Button variant="secondary" onClick={reset}>Restart</Button>
          </div>

          <div className="mt-7 flex flex-wrap gap-2 text-sm text-zinc-700">
            <Badge variant="outline">Live Telegram bot connected</Badge>
            <Badge variant="outline">DeepSeek reasoning</Badge>
            <Badge variant="outline">Exa technical sources</Badge>
            <Badge variant="outline">Context preserved</Badge>
          </div>

          <div className="mt-9 flex gap-3">
            <button onClick={() => setDevice("iphone")} className={`rounded-lg border px-4 py-2 text-sm transition ${device === "iphone" ? "border-cyan-300 bg-cyan-300/10 text-cyan-100" : "border-zinc-300 text-zinc-500"}`}>iPhone</button>
            <button onClick={() => setDevice("android")} className={`rounded-lg border px-4 py-2 text-sm transition ${device === "android" ? "border-cyan-300 bg-cyan-300/10 text-cyan-100" : "border-zinc-300 text-zinc-500"}`}>Android</button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[390px]">
          <div className={`relative overflow-hidden border-[9px] border-zinc-950 bg-zinc-100 shadow-[0_30px_90px_rgba(24,24,27,.16)] ${device === "iphone" ? "rounded-[3.25rem]" : "rounded-[2rem] border-[7px]"}`}>
            {device === "iphone" ? <div className="absolute left-1/2 top-2 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-stone-50" /> : <div className="absolute left-1/2 top-2 z-20 h-1.5 w-14 -translate-x-1/2 rounded-full bg-zinc-100" />}
            <div className="flex h-[720px] flex-col bg-zinc-50">
              <div className="flex items-center justify-between px-5 pb-2 pt-9 text-[11px] font-medium text-zinc-950"><span>9:41</span><span>●●● 5G ▰</span></div>
              <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-cyan-500 text-lg">🔧</div>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-1 font-semibold text-zinc-950">Workshop Master <span className="text-zinc-700">✓</span></div><p className="text-xs text-zinc-700">bot · online</p></div>
                <span className="text-xl text-zinc-700">⋮</span>
              </header>

              <div className="flex-1 overflow-hidden bg-[radial-gradient(circle_at_20%_10%,rgba(24,24,27,.05),transparent_40%),linear-gradient(135deg,#fafafa,#f4f4f5)] px-3 py-4">
                <p className="mx-auto mb-4 w-fit rounded-full bg-black/20 px-3 py-1 text-[10px] text-zinc-700">TODAY</p>
                <div className="space-y-3">
                  <BotMessage>Welcome to <b>The Workshop Master</b>. Tell me what you observe, by text, voice, or photo.</BotMessage>
                  {step >= 1 && <>
                    <UserMessage><div className="mb-2 flex items-center gap-2 text-cyan-200"><span className="grid h-7 w-7 place-items-center rounded-full bg-cyan-500/30">▶</span><span className="flex-1 tracking-[3px] text-cyan-100">▮▮▮▮▮▮▮</span><span className="text-[10px]">0:08</span></div><p>“Epson L3210. It says paper jam, but I cannot see any paper.”</p></UserMessage>
                    <BotMessage><p>I have recorded: <b>Epson L3210</b>, paper-jam message, no paper visible.</p><p className="mt-2">Let’s do one safe check. Turn it off, unplug it, then inspect the rear cover for a small paper fragment or object.</p><Safety>Do not use a metal object inside the printer.</Safety></BotMessage>
                  </>}
                  {step >= 2 && <>
                    <UserMessage>I checked the rear cover. There is no paper and no object.</UserMessage>
                    <BotMessage><p>Good - I kept that result. I will not ask for the model again.</p><p className="mt-2">Next safe test: switch the printer off, unplug it for two minutes, reconnect it, then check whether the paper-jam message returns before printing.</p><div className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-400/10 p-2.5 text-xs text-cyan-50"><b className="text-cyan-200">Technical sources</b><br /><span className="mt-1 block">• Epson L3210 Support</span><span className="block">• L3210 Series user guide</span></div></BotMessage>
                  </>}
                </div>
              </div>

              <footer className="flex items-center gap-2 border-t border-zinc-200 bg-white px-3 py-3"><span className="text-xl text-zinc-500">＋</span><div className="flex-1 rounded-2xl bg-zinc-100 px-4 py-2.5 text-sm text-zinc-500">Message</div><span className="text-xl text-zinc-700">➤</span></footer>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-zinc-500">Interactive mobile mock-up of the deployed Telegram workflow.</p>
        </div>
      </section>
    </main>
  );
}
function BotMessage({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-3 text-[13px] leading-5 text-zinc-900 shadow-lg shadow-black/10">{children}<span className="float-right ml-3 mt-1 text-[9px] text-zinc-500">9:41</span></div>;
}

function UserMessage({ children }: { children: React.ReactNode }) {
  return <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-zinc-900 px-3.5 py-3 text-[13px] leading-5 text-white shadow-lg shadow-black/10">{children}<span className="float-right ml-3 mt-1 text-[9px] text-zinc-400">9:42 ✓✓</span></div>;
}
function Safety({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 px-2.5 py-2 text-xs text-amber-100">⚠ {children}</p>;
}
