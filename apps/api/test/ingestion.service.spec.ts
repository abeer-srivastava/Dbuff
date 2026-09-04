import { describe, expect, it } from "bun:test";
import { NotFoundException } from "@nestjs/common";
import { IngestionService } from "../src/ingestion/ingestion.service.js";

describe("IngestionService", () => {
  it("provides raw staging rows with pagination metadata", async () => {
    const calls: { where: unknown; skip: number; take: number }[] = [];
    const prisma = {
      $transaction: async (queries: unknown[]) => {
        const q = queries[0] as { where: unknown; skip: number; take: number };
        calls.push(q);
        return [[{ id: 1, sourceLink: "https://reddit.com/x" }], 1];
      },
      ingestionStaging: { findMany: (query: unknown) => query, count: (query: unknown) => query },
    };
    const service = new IngestionService(prisma as never);
    const result = await service.listStaging({ page: 1, limit: 25 });
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(calls[0].skip).toBe(0);
    expect(calls[0].take).toBe(25);
  });

  it("filters staging by source platform", async () => {
    const calls: { where: unknown }[] = [];
    const prisma = {
      $transaction: async (queries: unknown[]) => {
        calls.push(queries[0] as { where: unknown });
        return [[], 0];
      },
      ingestionStaging: { findMany: (query: unknown) => query, count: (query: unknown) => query },
    };
    const service = new IngestionService(prisma as never);
    await service.listStaging({ sourcePlatform: "reddit", page: 1, limit: 25 });
    expect(calls[0].where).toEqual({ AND: [{ sourcePlatform: "reddit" }] });
  });

  it("promotes a staged reddit row into an OA story within a transaction", async () => {
    const calls: string[] = [];
    const prisma = {
      ingestionStaging: {
        findUnique: async () => ({ id: 5, sourceLink: "https://reddit.com/r/leetcode/x", sourcePlatform: "reddit" }),
      },
      $transaction: async (fn: (tx: {
        oAStory: { create: (args: { data: unknown }) => Promise<{ id: number }> };
        ingestionStaging: { update: (args: { data: { reviewed: boolean } }) => Promise<unknown>; delete: (args: unknown) => Promise<unknown> };
      }) => Promise<unknown>) => {
        return fn({
          oAStory: { create: async (args: { data: unknown }) => { calls.push(`create:${JSON.stringify(args.data)}`); return { id: 10 }; } },
          ingestionStaging: { update: async (args: { data: { reviewed: boolean } }) => { calls.push(`update:${args.data.reviewed}`); return {}; }, delete: async () => { calls.push("delete"); return {}; } },
        });
      },
    };
    const service = new IngestionService(prisma as never);
    const story = await service.promote(5, { storySummary: "User-authored summary" });
    expect(story.id).toBe(10);
    const createCall = calls.find((c) => c.startsWith("create:"));
    expect(createCall).toContain('"sourceLink":"https://reddit.com/r/leetcode/x"');
    expect(createCall).toContain('"sourcePlatform":"reddit"');
    expect(calls).toContain("update:true");
    expect(calls).toContain("delete");
  });

  it("throws NotFound when promoting a missing staging row", async () => {
    const prisma = { ingestionStaging: { findUnique: async () => null }, $transaction: async (fn: unknown) => fn };
    const service = new IngestionService(prisma as never);
    await expect(service.promote(999, { storySummary: "X" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("discards a staging row", async () => {
    let deletedId: number | undefined;
    const prisma = {
      ingestionStaging: { findUnique: async () => ({ id: 7 }), delete: async (args: { where: { id: number } }) => { deletedId = args.where.id; return { id: 7 }; } },
    };
    const service = new IngestionService(prisma as never);
    await service.discard(7);
    expect(deletedId).toBe(7);
  });

  it("throws NotFound when discarding a missing staging row", async () => {
    const prisma = { ingestionStaging: { findUnique: async () => null } };
    const service = new IngestionService(prisma as never);
    await expect(service.discard(404)).rejects.toBeInstanceOf(NotFoundException);
  });
});
