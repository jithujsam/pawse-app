import type { QA, RubricItem } from "../../domain/scoring";

export type ScoreRequest = {
  jobTitle: string;
  jobDescription: string;
  rubric: RubricItem[];
  answers: QA[];
};

export type ScoreResponse = {
  raw: unknown; // validated later by parseAndComputeScore
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
  refused?: boolean;
};

export interface Scorer {
  readonly name: string;
  score(req: ScoreRequest): Promise<ScoreResponse>;
  suggestQuestions(job: { title: string; description: string; location: string }): Promise<string[]>;
}
