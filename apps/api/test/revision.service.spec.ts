import { describe, expect, it } from "bun:test";
import { NotFoundException } from "@nestjs/common";
import { RevisionService } from "../src/revision/revision.service.js";

describe("RevisionService", () => {
  const makeService = (overrides: Record<string, (args: unknown) => unknown> = {}) => {
    const calls: { logData?: unknown; updateData?: unknown; transactionInvoked?: boolean } = {};
    const prisma = {
      problem: { findUnique: async () => ({ id: 1, status: "Attempted" }), update: async (args: { data: unknown }) => { calls.updateData = args.data; return { id: 1 }; } },
      revisionLog: { create: async (args: { data: unknown }) => { calls.logData = args.data; return { id: 1 }; } },
      $transaction: async (queries: unknown[]) => {
        calls.transactionInvoked = true;
        if (Array.isArray(queries)) {
          return Promise.all(queries.map((q) => (q as Promise<unknown>).catch((e) => Promise.reject(e))));
        }
        // interactive transaction (function form) not used in review
        throw new Error("unexpected transactional fn");
      },
      ...overrides,
    };
    const redis = { invalidateByPrefix: async () => undefined };
    return { service: new RevisionService(prisma as never, redis as never), calls };
  };

  it("schedules a 1-day next review for low confidence (1)", async () => {
    const { service, calls } = makeService();
    await service.review(1, { confidenceAtReview: 1 });
    const logData = calls.logData as { confidenceAtReview: number; nextReviewDue: Date };
    expect(logData.confidenceAtReview).toBe(1);
    const today = new Date();
    const expected = new Date(today);
    expected.setDate(expected.getDate() + 1);
    expect(logData.nextReviewDue.getUTCDate()).toBe(expected.getUTCDate());
    expect((calls.updateData as { confidence: number }).confidence).toBe(1);
  });

  it("schedules a 14-day interval for max confidence (5)", async () => {
    const { service, calls } = makeService();
    await service.review(1, { confidenceAtReview: 5 });
    const logData = calls.logData as { nextReviewDue: Date };
    const today = new Date();
    const expected = new Date(today);
    expected.setDate(expected.getDate() + 14);
    expect(logData.nextReviewDue.getUTCDate()).toBe(expected.getUTCDate());
  });

  it("flags a problem NeedsRevisit when confidence is low", async () => {
    const { service, calls } = makeService({});
    await service.review(1, { confidenceAtReview: 2 });
    const updateData = calls.updateData as { status?: string; timesRevisited?: object };
    expect(updateData.status).toBe("NeedsRevisit");
    expect(updateData.timesRevisited).toEqual({ increment: 1 });
  });

  it("does not downgrade a Solved-Optimal problem when confidence is low", async () => {
    const { service, calls } = makeService();
    // override findUnique to return SolvedOptimal
    (service as unknown as { prisma: { problem: { findUnique: () => Promise<{ id: number; status: string }> } } }).prisma.problem.findUnique = async () => ({ id: 1, status: "SolvedOptimal" });
    await service.review(1, { confidenceAtReview: 1 });
    const updateData = calls.updateData as { status?: string };
    expect(updateData.status).toBeUndefined();
  });

  it("throws NotFound when the problem does not exist", async () => {
    const prisma = { problem: { findUnique: async () => null } };
    const redis = { invalidateByPrefix: async () => undefined };
    const service = new RevisionService(prisma as never, redis as never);
    await expect(service.review(999, { confidenceAtReview: 3 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("dailyRecap computes a distinct-problem count and average confidence for a date", async () => {
    const prisma = {
      revisionLog: {
        findMany: async (query: { where: { reviewedAt: { gte: Date; lt: Date } } }) => {
          expect(query.where.reviewedAt.gte).toBeInstanceOf(Date);
          expect(query.where.reviewedAt.lt).toBeInstanceOf(Date);
          return [
            { problemId: 1, confidenceAtReview: 4, problem: { id: 1, title: "A", difficulty: "Easy", primaryPattern: { name: "P1" } } },
            { problemId: 1, confidenceAtReview: 5, problem: { id: 1, title: "A", difficulty: "Easy", primaryPattern: { name: "P1" } } },
            { problemId: 2, confidenceAtReview: 3, problem: { id: 2, title: "B", difficulty: "Hard", primaryPattern: { name: "P2" } } },
          ];
        },
      },
      problem: { count: async () => 1 },
    };
    const redis = { invalidateByPrefix: async () => undefined };
    const service = new RevisionService(prisma as never, redis as never);
    const recap = await service.dailyRecap("2026-09-04");
    expect(recap.distinctProblems).toBe(2);
    expect(recap.reviewedCount).toBe(3);
    expect(recap.averageConfidence).toBe(4);
    expect(recap.needsRevisit).toBe(1);
  });
});
