import type { ProcessTurnResult, SupportedLanguage } from "@/lib/diagnostics/orchestrator";

const channelLabels: Record<SupportedLanguage, { nextTest: string; safety: string; recap: string; lesson: string; community: string; confirmation: string }> = {
  en: { nextTest: "Next test", safety: "Safety", recap: "Technical recap", lesson: "Learn", community: "Community lead", confirmation: "Safe check" },
  fr: { nextTest: "Prochain test", safety: "Sécurité", recap: "Récap technique", lesson: "À retenir", community: "Piste communauté", confirmation: "Vérification sûre" },
  bm: { nextTest: "Test nata", safety: "Kununafoni", recap: "Tekiniki kɔrɔbɔ", lesson: "Dɔnni", community: "Jama ka sira", confirmation: "Kɔrɔbɔ kisɛ" },
  zh: { nextTest: "下一步测试", safety: "安全提示", recap: "技术小结", lesson: "学习要点", community: "社区线索", confirmation: "安全确认" },
};

export function formatChannelResponse(
  result: ProcessTurnResult,
  language: SupportedLanguage = "en",
): string {
  const labels = channelLabels[language];
  const lines = [result.decision.assistantMessage];
  if (result.decision.technicalRecap) {
    lines.push(`\n${labels.recap}: ${result.decision.technicalRecap}`);
  }
  if (result.decision.learningBrief) {
    lines.push(`\n${labels.lesson}: ${result.decision.learningBrief}`);
  }
  for (const lead of result.decision.communityLeads ?? []) {
    lines.push(`\n${labels.community} (${lead.sourceTitle}): ${lead.insight}\n${labels.confirmation}: ${lead.safeConfirmation}`);
  }
  if (result.decision.nextTest) {
    lines.push(`\n${labels.nextTest}: ${result.decision.nextTest.instruction}`);
  }
  if (result.decision.safetyWarnings.length) {
    lines.push(`\n${labels.safety}: ${result.decision.safetyWarnings.join(" ")}`);
  }

  return lines.join("\n").slice(0, 4_000);
}
