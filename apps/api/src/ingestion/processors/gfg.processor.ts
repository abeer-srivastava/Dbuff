import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service.js";
import { GfgRssClient } from "../clients/gfg-rss.client.js";
import { insertPosts } from "../insert-posts.js";
import { GFG_QUEUE } from "../queue-names.js";

export interface GfgJobData {
  force?: boolean;
}

@Processor(GFG_QUEUE)
export class GfgProcessor extends WorkerHost {
  private readonly logger = new Logger(GfgProcessor.name);

  constructor(private readonly prisma: PrismaService, private readonly gfg: GfgRssClient) {
    super();
  }

  async process(_job: Job<GfgJobData>): Promise<{ inserted: number; skipped: number }> {
    this.logger.log("Starting GfG RSS ingestion");
    const items = await this.gfg.fetchFeed();
    const result = await insertPosts(this.prisma, items, "gfg");
    this.logger.log(`GfG ingestion complete: ${result.inserted} inserted, ${result.skipped} skipped (duplicates)`);
    return result;
  }
}
