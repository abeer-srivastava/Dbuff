import { describe, expect, it } from "bun:test";
import { RedditProcessor } from "../src/ingestion/processors/reddit.processor.js";
import { GfgProcessor } from "../src/ingestion/processors/gfg.processor.js";
import { CleanupProcessor } from "../src/ingestion/processors/cleanup.processor.js";
import { insertPosts, isUniqueViolation } from "../src/ingestion/insert-posts.js";

describe("Ingestion processors", () => {
  it("RedditProcessor stages fetched posts through the Reddit client", async () => {
    const prisma = {
      ingestionStaging: {
        create: async (args: { data: { sourceLink: string; sourcePlatform: string } }) => ({ id: args.data.sourceLink.length }),
      },
    };
    const reddit = {
      fetchNewPosts: async () => [
        { sourceLink: "https://www.reddit.com/r/leetcode/1", title: "OA at Meta", excerpt: "e1" },
        { sourceLink: "https://www.reddit.com/r/leetcode/2", title: "Coding round", excerpt: "e2" },
      ],
    };
    const processor = new RedditProcessor(prisma as never, reddit as never);
    const result = await processor.process({ id: "1", data: {} } as never);
    expect(result).toEqual({ inserted: 2, skipped: 0 });
  });

  it("GfgProcessor stages fetched feed items through the GfG client", async () => {
    const prisma = {
      ingestionStaging: { create: async () => ({ id: 1 }) },
    };
    const gfg = {
      fetchFeed: async () => [{ sourceLink: "https://www.geeksforgeeks.org/a/", title: "A", excerpt: "x" }],
    };
    const processor = new GfgProcessor(prisma as never, gfg as never);
    const result = await processor.process({ id: "1", data: {} } as never);
    expect(result).toEqual({ inserted: 1, skipped: 0 });
  });

  it("CleanupProcessor removes rows older than the retention window", async () => {
    let cutoff: Date | undefined;
    const prisma = {
      ingestionStaging: {
        deleteMany: async (args: { where: { fetchedAt: { lt: Date } } }) => {
          cutoff = args.where.fetchedAt.lt;
          return { count: 3 };
        },
      },
    };
    const processor = new CleanupProcessor(prisma as never);
    const result = await processor.process({ id: "1", data: { retentionDays: 30 } } as never);
    expect(result).toEqual({ removed: 3, retentionDays: 30 });
    expect(cutoff).toBeInstanceOf(Date);
  });

  it("CleanupProcessor defaults to 30-day retention when not provided", async () => {
    const prisma = { ingestionStaging: { deleteMany: async () => ({ count: 0 }) } };
    const processor = new CleanupProcessor(prisma as never);
    const result = await processor.process({ id: "1", data: {} } as never);
    expect(result.retentionDays).toBe(30);
  });
});

describe("insertPosts", () => {
  it("stages each item and reports duplicates as skipped", async () => {
    const calls: string[] = [];
    const prisma = {
      ingestionStaging: {
        create: async () => {
          calls.push("created");
          const err = new Error("dup") as Error & { code?: string };
          if (calls.length === 1) return { id: 1 };
          err.code = "P2002";
          throw err;
        },
      },
    };
    const result = await insertPosts(
      prisma as never,
      [
        { sourceLink: "https://x/1", title: "A", excerpt: "x" },
        { sourceLink: "https://x/2", title: "B", excerpt: "y" },
      ],
      "gfg",
    );
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("caps title and excerpt lengths", async () => {
    let data: { rawTitle?: string; rawExcerpt?: string } | undefined;
    const prisma = {
      ingestionStaging: {
        create: async (args: { data: { rawTitle: string; rawExcerpt: string } }) => {
          data = args.data;
          return { id: 1 };
        },
      },
    };
    const longTitle = "T".repeat(500);
    const longExcerpt = "E".repeat(600);
    await insertPosts(prisma as never, [{ sourceLink: "https://x/1", title: longTitle, excerpt: longExcerpt }], "reddit");
    expect(data!.rawTitle!.length).toBeLessThanOrEqual(300);
    expect(data!.rawExcerpt!.length).toBeLessThanOrEqual(400);
  });

  it("isUniqueViolation detects Prisma P2002 codes", () => {
    const err = new Error("unique") as Error & { code?: string };
    err.code = "P2002";
    expect(isUniqueViolation(err)).toBe(true);
    expect(isUniqueViolation(new Error("other"))).toBe(false);
    expect(isUniqueViolation("not-an-error")).toBe(false);
  });
});
