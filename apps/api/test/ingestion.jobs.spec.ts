import { describe, expect, it } from "bun:test";
import { IngestionJobs } from "../src/ingestion/ingestion.jobs.js";
import { GfgRssClient } from "../src/ingestion/clients/gfg-rss.client.js";
import { RedditClient } from "../src/ingestion/clients/reddit.client.js";

describe("IngestionJobs", () => {
  it("deletes staging rows older than the retention cutoff", async () => {
    const prisma = { ingestionStaging: { deleteMany: async (args: { where: { fetchedAt: { lt: Date } } }) => { expect(args.where.fetchedAt.lt).toBeInstanceOf(Date); return { count: 3 }; } } };
    const jobs = new IngestionJobs(prisma as never, {} as RedditClient, {} as GfgRssClient);
    const result = await jobs.cleanupStaging();
    expect(result).toBeUndefined();
  });

  it("syncGfg stages each feed item and skips duplicate source links", async () => {
    const calls: { sourceLink?: string; sourcePlatform?: string }[] = [];
    const prisma = {
      ingestionStaging: {
        create: async (args: { data: { sourceLink: string; sourcePlatform: string; rawTitle: string; rawExcerpt: string } }) => {
          calls.push({ sourceLink: args.data.sourceLink, sourcePlatform: args.data.sourcePlatform });
          return { id: 1 };
        },
        deleteMany: async () => ({ count: 0 }),
      },
    };
    const gfg = {
      fetchFeed: async () => [
        { sourceLink: "https://www.geeksforgeeks.org/a/", title: "A", excerpt: "x" },
        { sourceLink: "https://www.geeksforgeeks.org/b/", title: "B", excerpt: "y" },
      ],
    };
    const jobs = new IngestionJobs(prisma as never, {} as RedditClient, gfg as unknown as GfgRssClient);
    await jobs.syncGfg();
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.sourcePlatform === "gfg")).toBe(true);
  });

  it("treats a unique-violation on staging insert as a duplicate to skip, not a failure", async () => {
    const calls: string[] = [];
    const prisma = {
      ingestionStaging: {
        create: async () => {
          const err = new Error("duplicate") as Error & { code?: string };
          err.code = "P2002";
          throw err;
        },
        deleteMany: async () => ({ count: 0 }),
      },
    };
    const reddit = { fetchNewPosts: async () => [{ sourceLink: "https://reddit.com/r/leetcode/dup", title: "Dup", excerpt: "e" }] };
    const jobs = new IngestionJobs(prisma as never, reddit as unknown as RedditClient, {} as GfgRssClient);
    await jobs.syncReddit();
    expect(calls).toEqual([]);
  });
});
