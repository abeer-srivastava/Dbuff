import { Injectable, NotFoundException } from "@nestjs/common";
import { ProblemStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";
import { CreateReviewDto } from "./dto/review.dto.js";

const REVIEW_INTERVALS_DAYS = [0, 1, 1, 3, 7, 14] as const;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function normalizeToUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class RevisionService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  private static nextReviewDate(confidence: number): Date {
    return addDays(todayUTC(), REVIEW_INTERVALS_DAYS[confidence] ?? 14);
  }

  async queue() {
    const today = todayUTC();
    return this.prisma.problem.findMany({
      where: {
        OR: [
          { revisionLogs: { some: { nextReviewDue: { lte: today } } } },
          { revisionLogs: { none: {} }, status: { in: [ProblemStatus.Attempted, ProblemStatus.Solved, ProblemStatus.SolvedOptimal, ProblemStatus.NeedsRevisit] } },
        ],
      },
      include: {
        primaryPattern: true,
        revisionLogs: { orderBy: { reviewedAt: "desc" }, take: 1 },
        _count: { select: { revisionLogs: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async dailyRecap(date?: string) {
    const target = date ? new Date(date) : todayUTC();
    const start = normalizeToUTC(target);
    const end = addDays(start, 1);
    const logs = await this.prisma.revisionLog.findMany({
      where: { reviewedAt: { gte: start, lt: end } },
      include: { problem: { select: { id: true, title: true, difficulty: true, primaryPattern: true } } },
      orderBy: { reviewedAt: "asc" },
    });
    const reviewedProblemIds = new Set(logs.map((log) => log.problemId));
    const averageConfidence = logs.length ? logs.reduce((sum, log) => sum + (log.confidenceAtReview ?? 3), 0) / logs.length : 0;
    const needsRevisit = await this.prisma.problem.count({ where: { status: ProblemStatus.NeedsRevisit } });
    return {
      date: start.toISOString().slice(0, 10),
      reviewedCount: logs.length,
      distinctProblems: reviewedProblemIds.size,
      averageConfidence: logs.length ? Number(averageConfidence.toFixed(2)) : null,
      needsRevisit,
      logs,
    };
  }

  async weeklyMinCoverage() {
    const start = todayUTC();
    const weekFromNow = addDays(start, 7);
    const due = await this.prisma.revisionLog.groupBy({
      by: ["problemId"],
      where: { nextReviewDue: { lte: weekFromNow } },
      _min: { nextReviewDue: true },
    });
    const dueCount = due.length;
    const problems = await this.prisma.problem.findMany({
      where: { id: { in: due.map((entry) => entry.problemId) } },
      include: { primaryPattern: true, _count: { select: { revisionLogs: true } } },
    });
    const lowConfidence = await this.prisma.problem.findMany({
      where: { confidence: { lte: 2 }, status: { in: [ProblemStatus.Solved, ProblemStatus.SolvedOptimal, ProblemStatus.Attempted] } },
      include: { primaryPattern: true, _count: { select: { revisionLogs: true } } },
    });
    const weakPatterns = await this.prisma.pattern.findMany({
      where: { primaryProblems: { some: { status: { notIn: [ProblemStatus.Solved, ProblemStatus.SolvedOptimal] } } } },
      include: {
        _count: { select: { primaryProblems: true } },
        primaryProblems: { select: { status: true } },
      },
      orderBy: { name: "asc" },
    });
    return {
      weekStart: start.toISOString().slice(0, 10),
      weekEnd: weekFromNow.toISOString().slice(0, 10),
      dueForReview: problems,
      dueCount,
      lowConfidenceCount: lowConfidence.length,
      weakPatternCount: weakPatterns.length,
      weakPatterns: weakPatterns.map((p) => ({ id: p.id, name: p.name, total: p._count.primaryProblems })),
      lowConfidenceProblems: lowConfidence,
    };
  }

  async review(problemId: number, dto: CreateReviewDto) {
    const problem = await this.prisma.problem.findUnique({ where: { id: problemId } });
    if (!problem) throw new NotFoundException(`Problem ${problemId} was not found`);
    const confidence = dto.confidenceAtReview;
    const nextDue = RevisionService.nextReviewDate(confidence);
    const reviewedAt = dto.reviewedAt ? new Date(dto.reviewedAt) : new Date();
    const [log, updated] = await this.prisma.$transaction([
      this.prisma.revisionLog.create({ data: { problemId, confidenceAtReview: confidence, nextReviewDue: nextDue, reviewedAt } }),
      this.prisma.problem.update({
        where: { id: problemId },
        data: {
          confidence,
          timesRevisited: { increment: 1 },
          ...(problem.status !== ProblemStatus.Solved && problem.status !== ProblemStatus.SolvedOptimal && confidence >= 4 ? { status: ProblemStatus.Solved } : {}),
          ...(confidence <= 2 && problem.status !== ProblemStatus.SolvedOptimal ? { status: ProblemStatus.NeedsRevisit } : {}),
        },
      }),
    ]);
    await this.redis.invalidateByPrefix("dashboard:");
    return { log, problem: updated, nextReviewDue: nextDue };
  }
}
