import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service.js";
import { GfgRssClient } from "./clients/gfg-rss.client.js";
import { RedditClient } from "./clients/reddit.client.js";

const RETENTION_DAYS = 30;

@Injectable()
export class IngestionJobs {
  private readonly logger = new Logger(IngestionJobs.name);

  constructor(private readonly prisma: PrismaService, private readonly reddit: RedditClient, private readonly gfg: GfgRssClient) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async syncReddit() {
    this.logger.log("Starting Reddit ingestion");
    const posts = await this.reddit.fetchNewPosts();
    const result = await this.insertPosts(posts, "reddit");
    this.logger.log(`Reddit ingestion complete: ${result.inserted} inserted, ${result.skipped} skipped (duplicates)`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async syncGfg() {
    this.logger.log("Starting GfG RSS ingestion");
    const items = await this.gfg.fetchFeed();
    const result = await this.insertPosts(items, "gfg");
    this.logger.log(`GfG ingestion complete: ${result.inserted} inserted, ${result.skipped} skipped (duplicates)`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupStaging() {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.ingestionStaging.deleteMany({ where: { fetchedAt: { lt: cutoff } } });
    this.logger.log(`Staging cleanup removed ${count} rows older than ${RETENTION_DAYS} days`);
  }

  private async insertPosts(posts: { sourceLink: string; title: string; excerpt: string }[], platform: "reddit" | "gfg") {
    let inserted = 0;
    let skipped = 0;
    for (const post of posts) {
      try {
        await this.prisma.ingestionStaging.create({
          data: {
            sourcePlatform: platform,
            sourceLink: post.sourceLink,
            rawTitle: post.title?.slice(0, 300) ?? null,
            rawExcerpt: post.excerpt?.slice(0, 400) ?? null,
          },
        });
        inserted += 1;
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          skipped += 1;
        } else {
          this.logger.warn(`Failed to stage item ${post.sourceLink}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    return { inserted, skipped };
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
  }
}
