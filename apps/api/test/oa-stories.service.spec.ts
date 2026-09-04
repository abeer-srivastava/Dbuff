import { describe, expect, it } from "bun:test";
import { NotFoundException } from "@nestjs/common";
import { OaStoriesService } from "../src/oa-stories/oa-stories.service.js";

describe("OaStoriesService", () => {
  it("combines company, pattern, and text-search filters with AND across one where clause", async () => {
    const calls: { where?: Record<string, unknown>; skip?: number; take?: number }[] = [];
    const prisma = {
      $transaction: async (queries: unknown[]) => {
        calls.push(queries[0] as { where?: Record<string, unknown>; skip?: number; take?: number });
        return [[], 0];
      },
      oAStory: { findMany: (query: unknown) => query, count: (query: unknown) => query },
    };
    const redis = { invalidateByPrefix: async () => undefined };
    const service = new OaStoriesService(prisma as never, redis as never);
    await service.findAll({ company: "Google", pattern: 3, q: "arrays", page: 1, limit: 25 });
    const call = calls[0]!;
    expect(call.where).toEqual({ AND: [{ company: { contains: "Google", mode: "insensitive" } }, { underlyingPatternId: 3 }, { OR: [{ storySummary: { contains: "arrays", mode: "insensitive" } }, { myApproach: { contains: "arrays", mode: "insensitive" } }, { company: { contains: "arrays", mode: "insensitive" } }] }] });
  });

  it("filters by roleLevel and sourcePlatform when supplied", async () => {
    const calls: { where?: Record<string, unknown> }[] = [];
    const prisma = {
      $transaction: async (queries: unknown[]) => {
        calls.push(queries[0] as { where?: Record<string, unknown> });
        return [[], 0];
      },
      oAStory: { findMany: (query: unknown) => query, count: (query: unknown) => query },
    };
    const redis = { invalidateByPrefix: async () => undefined };
    const service = new OaStoriesService(prisma as never, redis as never);
    await service.findAll({ roleLevel: "sde1", sourcePlatform: "reddit", page: 1, limit: 25 });
    expect(calls[0]!.where).toEqual({ AND: [{ roleLevel: "sde1" }, { sourcePlatform: "reddit" }] });
  });

  it("builds a plain where when no filters are given", async () => {
    const calls: { where?: Record<string, unknown> }[] = [];
    const prisma = {
      $transaction: async (queries: unknown[]) => {
        calls.push(queries[0] as { where?: Record<string, unknown> });
        return [[], 0];
      },
      oAStory: { findMany: (query: unknown) => query, count: (query: unknown) => query },
    };
    const redis = { invalidateByPrefix: async () => undefined };
    const service = new OaStoriesService(prisma as never, redis as never);
    await service.findAll({ page: 1, limit: 25 });
    expect(calls[0]!.where).toEqual({});
  });

  it("throws NotFound when a story is missing", async () => {
    const prisma = { oAStory: { findUnique: async () => null } };
    const redis = { invalidateByPrefix: async () => undefined };
    const service = new OaStoriesService(prisma as never, redis as never);
    await expect(service.findOne(404)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("connects underlying pattern and closest problem when creating", async () => {
    let createdData: unknown;
    const prisma = {
      oAStory: { create: async (args: { data: unknown }) => { createdData = args.data; return { id: 1 }; } },
    };
    const redis = { invalidateByPrefix: async () => undefined };
    const service = new OaStoriesService(prisma as never, redis as never);
    await service.create({ storySummary: "Mock round", company: "Meta", underlyingPatternId: 7, closestLcProblemId: 12 });
    expect(createdData).toEqual({
      storySummary: "Mock round",
      company: "Meta",
      underlyingPattern: { connect: { id: 7 } },
      closestLcProblem: { connect: { id: 12 } },
    });
  });

  it("invalidates dashboard cache on create, update, and delete", async () => {
    let invalidated = false;
    const prisma = {
      oAStory: {
        create: async () => ({ id: 1 }),
        findUnique: async () => ({ id: 1 }),
        update: async () => ({ id: 1 }),
        delete: async () => ({ id: 1 }),
      },
    };
    const redis = { invalidateByPrefix: async (prefix: string) => { invalidated = prefix === "dashboard:"; } };
    const service = new OaStoriesService(prisma as never, redis as never);
    await service.create({ storySummary: "S" });
    expect(invalidated).toBe(true);
    invalidated = false;
    await service.update(1, { storySummary: "S2" });
    expect(invalidated).toBe(true);
    invalidated = false;
    await service.remove(1);
    expect(invalidated).toBe(true);
  });
});
