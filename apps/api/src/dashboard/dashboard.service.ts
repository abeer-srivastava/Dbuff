import { Injectable } from "@nestjs/common";
import { ProblemStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";

type PatternCompletion = { id: number; name: string; total: number; solved: number; completionPercent: number; avgConfidence: number | null; difficultyBreakdown: Record<string, number> };
const ttlSeconds = 300;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}
  patternCompletion() { return this.cached<PatternCompletion[]>("dashboard:pattern-completion", async () => {
    const patterns = await this.prisma.pattern.findMany({ include: { primaryProblems: { select: { status: true, confidence: true, difficulty: true } } }, orderBy: { name: "asc" } });
    return patterns.map((pattern) => {
      const total = pattern.primaryProblems.length;
      const solved = pattern.primaryProblems.filter((problem) => problem.status === ProblemStatus.Solved || problem.status === ProblemStatus.SolvedOptimal).length;
      const confidences = pattern.primaryProblems.flatMap((problem) => problem.confidence === null ? [] : [problem.confidence]);
      const difficultyBreakdown = pattern.primaryProblems.reduce<Record<string, number>>((counts, problem) => { if (problem.difficulty) counts[problem.difficulty] = (counts[problem.difficulty] ?? 0) + 1; return counts; }, {});
      return { id: pattern.id, name: pattern.name, total, solved, completionPercent: total ? Math.round((solved / total) * 100) : 0, avgConfidence: confidences.length ? Number((confidences.reduce((sum, value) => sum + value, 0) / confidences.length).toFixed(2)) : null, difficultyBreakdown };
    });
  }); }
  weakestPatterns() { return this.cached<PatternCompletion[]>("dashboard:weakest-patterns", async () => (await this.patternCompletion()).filter((pattern) => pattern.total > 0).sort((a, b) => this.weakness(b) - this.weakness(a)).slice(0, 5)); }
  stats() { return this.cached("dashboard:stats", async () => {
    const [total, solved, attempted, needsRevisit] = await Promise.all([
      this.prisma.problem.count(), this.prisma.problem.count({ where: { status: { in: [ProblemStatus.Solved, ProblemStatus.SolvedOptimal] } } }), this.prisma.problem.count({ where: { status: ProblemStatus.Attempted } }), this.prisma.problem.count({ where: { status: ProblemStatus.NeedsRevisit } }),
    ]);
    return { total, solved, attempted, needsRevisit, completionPercent: total ? Math.round((solved / total) * 100) : 0 };
  }); }
  private weakness(pattern: PatternCompletion) { return (100 - pattern.completionPercent) * (6 - (pattern.avgConfidence ?? 1)); }
  private async cached<T>(key: string, producer: () => Promise<T>): Promise<T> { const cached = await this.redis.get<T>(key); if (cached) return cached; const value = await producer(); await this.redis.set(key, value, ttlSeconds); return value; }
}
