import type { ProcessTurnResult } from "@/lib/diagnostics/orchestrator";

export function formatChannelResponse(result: ProcessTurnResult): string {
  const lines = [result.decision.assistantMessage];
  if (result.session.currentTest) {
    lines.push(`\nNext test: ${result.session.currentTest.instruction}`);
  }
  if (result.session.safetyWarnings.length) {
    lines.push(`\nSafety: ${result.session.safetyWarnings.at(-1)}`);
  }

  return lines.join("\n").slice(0, 4_000);
}
