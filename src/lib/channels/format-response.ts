import type { ProcessTurnResult, SupportedLanguage } from "@/lib/diagnostics/orchestrator";

const channelLabels: Record<SupportedLanguage, { nextTest: string; safety: string }> = {
  en: { nextTest: "Next test", safety: "Safety" },
  fr: { nextTest: "Prochain test", safety: "Sécurité" },
  bm: { nextTest: "Test nata", safety: "Kununafoni" },
  zh: { nextTest: "下一步测试", safety: "安全提示" },
};

export function formatChannelResponse(
  result: ProcessTurnResult,
  language: SupportedLanguage = "en",
): string {
  const labels = channelLabels[language];
  const lines = [result.decision.assistantMessage];
  if (result.decision.nextTest) {
    lines.push(`\n${labels.nextTest}: ${result.decision.nextTest.instruction}`);
  }
  if (result.decision.safetyWarnings.length) {
    lines.push(`\n${labels.safety}: ${result.decision.safetyWarnings.join(" ")}`);
  }

  return lines.join("\n").slice(0, 4_000);
}
