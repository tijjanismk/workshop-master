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
  sourceType: "manufacturer" | "community" | "video" | "web";
  query: string;
};

export type DiagnosticSession = {
  id: string;
  machine: Machine;
  symptoms: string[];
  observations: Observation[];
  hypotheses: Hypothesis[];
  tests: DiagnosticTest[];
  retrievedSources: TechnicalSource[];
  /** Normalized queries already sent to technical retrieval for this session. */
  retrievalQueries: string[];
  currentTest?: DiagnosticTest;
  safetyWarnings: string[];
  status: "active" | "resolved" | "escalated";
  createdAt: string;
  updatedAt: string;
};

export type AgentDecision = {
  assistantMessage: string;
  /** Up to three contextual questions generated from the first reported fault. */
  followUpQuestions?: Array<{ question: string; choices: string[] }>;
  /** Ready-to-send customer wording when the turn is about workshop operations. */
  customerReply?: string;
  /** Short explanation of the mechanism behind the current diagnostic path. */
  technicalRecap?: string;
  /** Plain-language teaching note derived from the current evidence. */
  learningBrief?: string;
  /** Community reports are leads, never proof; each one includes a safe confirmation. */
  communityLeads?: Array<{ sourceTitle: string; insight: string; safeConfirmation: string }>;
  machine: Machine;
  observations: string[];
  visualObservations: string[];
  hypotheses: Omit<Hypothesis, "id">[];
  nextTest?: Omit<DiagnosticTest, "id" | "createdAt">;
  safetyWarnings: string[];
  status: DiagnosticSession["status"];
};
