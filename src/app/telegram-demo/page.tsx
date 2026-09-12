"use client";

import { Button, Chip } from "@heroui/react";
import { useState } from "react";

type Step = 0 | 1 | 2;

export default function TelegramDemoPage() {
  const [step, setStep] = useState<Step>(0);
  const [device, setDevice] = useState<"iphone" | "android">("iphone");

  const advance = () => setStep((current) => Math.min(2, current + 1) as Step);
  const reset = () => setStep(0);

  return (
    <main className="min-h-screen overflow-hidden bg-[#061322] px-4 py-8 text-slate-100 sm:px-6 lg:px-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_5%,rgba(14,165,233,.22),transparent_30%),radial-gradient(circle_at_82%_72%,rgba(37,99,235,.2),transparent_32%)]" />
      <section className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_420px]">
        <div className="max-w-2xl">
          <Chip color="accent" variant="soft">LIVE DEMO FLOW</Chip>
          <p className="mt-5 text-sm font-semibold tracking-[.2em] text-cyan-300 uppercase">Telegram channel simulation</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">A real diagnostic conversation, inside the phone.</h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">The Workshop Master remembers what the technician said, gives one safe action, and uses technical sources before moving forward.</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="primary" onPress={advance}>{step === 0 ? "Start Telegram demo" : step === 1 ? "Send the test result" : "Demo completed"}</Button>
            <Button variant="secondary" onPress={reset}>Restart</Button>
          </div>

          <div className="mt-7 flex flex-wrap gap-2 text-sm text-slate-300">
            <Chip size="sm" variant="soft">Live Telegram bot connected</Chip>
            <Chip size="sm" variant="soft">DeepSeek reasoning</Chip>
            <Chip size="sm" variant="soft">Exa technical sources</Chip>
            <Chip size="sm" variant="soft">Context preserved</Chip>
          </div>

          <div className="mt-9 flex gap-3">
            <button onClick={() => setDevice("iphone")} className={`rounded-lg border px-4 py-2 text-sm transition ${device === "iphone" ? "border-cyan-300 bg-cyan-300/10 text-cyan-100" : "border-slate-700 text-slate-400"}`}>iPhone</button>
            <button onClick={() => setDevice("android")} className={`rounded-lg border px-4 py-2 text-sm transition ${device === "android" ? "border-cyan-300 bg-cyan-300/10 text-cyan-100" : "border-slate-700 text-slate-400"}`}>Android</button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[390px]">
          <div className={`relative overflow-hidden border-[9px] border-slate-950 bg-[#0d1f2c] shadow-[0_30px_90px_rgba(0,0,0,.55)] ${device === "iphone" ? "rounded-[3.25rem]" : "rounded-[2rem] border-[7px]"}`}>
            {device === "iphone" ? <div className="absolute left-1/2 top-2 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-slate-950" /> : <div className="absolute left-1/2 top-2 z-20 h-1.5 w-14 -translate-x-1/2 rounded-full bg-slate-800" />}
            <div className="flex h-[720px] flex-col bg-[#0e1621]">
              <div className="flex items-center justify-between px-5 pb-2 pt-9 text-[11px] font-medium text-white"><span>9:41</span><span>●●● 5G ▰</span></div>
              <header className="flex items-center gap-3 border-b border-white/5 bg-[#17212b] px-4 py-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-cyan-500 text-lg">🔧</div>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-1 font-semibold text-white">Workshop Master <span className="text-cyan-300">✓</span></div><p className="text-xs text-cyan-300">bot · online</p></div>
                <span className="text-xl text-slate-300">⋮</span>
              </header>

              <div className="flex-1 overflow-hidden bg-[radial-gradient(circle_at_20%_10%,rgba(50,74,92,.35),transparent_40%),linear-gradient(135deg,#17212b,#0e1621)] px-3 py-4">
                <p className="mx-auto mb-4 w-fit rounded-full bg-black/20 px-3 py-1 text-[10px] text-slate-300">TODAY</p>
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

              <footer className="flex items-center gap-2 border-t border-white/5 bg-[#17212b] px-3 py-3"><span className="text-xl text-slate-400">＋</span><div className="flex-1 rounded-2xl bg-[#242f3d] px-4 py-2.5 text-sm text-slate-400">Message</div><span className="text-xl text-cyan-300">➤</span></footer>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">Interactive mobile mock-up of the deployed Telegram workflow.</p>
        </div>
      </section>
    </main>
  );
}

function BotMessage({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-[#182533] px-3.5 py-3 text-[13px] leading-5 text-slate-100 shadow-lg shadow-black/10">{children}<span className="float-right ml-3 mt-1 text-[9px] text-slate-500">9:41</span></div>;
}

function UserMessage({ children }: { children: React.ReactNode }) {
  return <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-[#2b5278] px-3.5 py-3 text-[13px] leading-5 text-white shadow-lg shadow-black/10">{children}<span className="float-right ml-3 mt-1 text-[9px] text-cyan-100/60">9:42 ✓✓</span></div>;
}

function Safety({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 px-2.5 py-2 text-xs text-amber-100">⚠ {children}</p>;
}
