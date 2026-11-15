export const CONTEXT_TYPES = [
  "decision",
  "requirement",
  "constraint",
  "research",
  "rejected-approach",
  "open-question",
  "project-state",
] as const;

export type ContextType = (typeof CONTEXT_TYPES)[number];

export interface ContextRecord {
  id: string;
  title: string;
  type: ContextType;
  schemaVersion?: number;
  content?: Record<string, string | string[]>;
  projectId: string;
  status: "approved";
  updatedAt: string;
  owner: string;
  tags: string[];
  question: string;
  summary: string;
  rationale: string;
  constraints: string[];
  alternatives: string[];
  discussionSummary: string;
  sourceReferences: string[];
}
