import { describe, expect, it } from "bun:test";
import { ProblemsService } from "../src/problems/problems.service.js";

describe("ProblemsService", () => {
  it("combines a pattern filter and text search rather than overwriting either", async () => {
    const calls: unknown[] = [];
    const prisma = {
      $transaction: async (queries: unknown[]) => { calls.push(queries); return [[], 0]; },
      problem: { findMany: (query: unknown) => query, count: (query: unknown) => query },
    };
    const redis = { invalidateByPrefix: async () => undefined };
    const service = new ProblemsService(prisma as never, redis as never);
    await service.findAll({ pattern: 2, q: "window", page: 1, limit: 25 });
    const [findMany] = calls[0] as [{ where: { AND: unknown[] } }];
    expect(findMany.where.AND).toHaveLength(2);
  });
  it("invalidates dashboard cache after creating a problem", async () => {
    let invalidated = false;
    const prisma = { problem: { create: async () => ({ id: 1, title: "Two Sum" }) } };
    const redis = { invalidateByPrefix: async (prefix: string) => { invalidated = prefix === "dashboard:"; } };
    const service = new ProblemsService(prisma as never, redis as never);
    await service.create({ title: "Two Sum", primaryPatternId: 1 });
    expect(invalidated).toBe(true);
  });
});
