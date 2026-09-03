import { describe, expect, it } from "bun:test";
import { DashboardService } from "../src/dashboard/dashboard.service.js";

describe("DashboardService", () => {
  it("computes solved counts, completion, confidence, and caches the result", async () => {
    const stored = new Map<string, unknown>();
    const prisma = { pattern: { findMany: async () => [{ id: 1, name: "Sliding Window", primaryProblems: [
      { status: "Solved", confidence: 4, difficulty: "Medium" }, { status: "Todo", confidence: 2, difficulty: "Easy" }, { status: "SolvedOptimal", confidence: null, difficulty: "Medium" },
    ] }] } };
    const redis = { get: async <T>(key: string) => (stored.get(key) as T | undefined) ?? null, set: async (key: string, value: unknown) => { stored.set(key, value); } };
    const service = new DashboardService(prisma as never, redis as never);
    const result = await service.patternCompletion();
    expect(result[0]).toEqual({ id: 1, name: "Sliding Window", total: 3, solved: 2, completionPercent: 67, avgConfidence: 3, difficultyBreakdown: { Medium: 2, Easy: 1 } });
    expect(stored.has("dashboard:pattern-completion")).toBe(true);
  });
});
