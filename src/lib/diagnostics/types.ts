export type ObservationSource = "technician" | "agent" | "retrieval" | "vision";

export type Observation = {
  id: string;
  source: ObservationSource;
  text: string;
  createdAt: string;
};

export type Hypothesis = {
  id: string;
  title: string;
  rationale: string;
  confidence: "low" | "medium" | "high";
  status: "open" | "supported" | "ruled_out";
};

export type DiagnosticTest = {
  id: string;
  title: string;
  instruction: string;
  purpose: string;
  risk: "low" | "medium" | "high";
  requiresPowerOff: boolean;
  createdAt: string;
};

export type Machine = {
  manufacturer?: string;
  model?: string;
  type?: string;
};

export type TechnicalSource = {
  title: string;
  url: string;
  highlights: string[];
};

export type DiagnosticSession = {
  id: string;
  machine: Machine;
  symptoms: string[];
  observations: Observation[];
  hypotheses: Hypothesis[];
  tests: DiagnosticTest[];
  retrievedSources: TechnicalSource[];
  currentTest?: DiagnosticTest;
  safetyWarnings: string[];
  status: "active" | "resolved" | "escalated";
  createdAt: string;
  updatedAt: string;
};

export type AgentDecision = {
  assistantMessage: string;
  machine: Machine;
  observations: string[];
  visualObservations: string[];
  hypotheses: Omit<Hypothesis, "id">[];
  nextTest?: Omit<DiagnosticTest, "id" | "createdAt">;
  safetyWarnings: string[];
  status: DiagnosticSession["status"];
};
