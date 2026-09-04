import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RedditClient } from "../clients/reddit.client.js";
import { insertPosts } from "../insert-posts.js";
import { REDDIT_QUEUE } from "../queue-names.js";

export interface RedditJobData {
  subreddits?: string[];
}

@Processor(REDDIT_QUEUE)
export class RedditProcessor extends WorkerHost {
  private readonly logger = new Logger(RedditProcessor.name);

  constructor(private readonly prisma: PrismaService, private readonly reddit: RedditClient) {
    super();
  }

  async process(_job: Job<RedditJobData>): Promise<{ inserted: number; skipped: number }> {
    this.logger.log("Starting Reddit ingestion");
    const posts = await this.reddit.fetchNewPosts();
    const result = await insertPosts(this.prisma, posts, "reddit");
    this.logger.log(`Reddit ingestion complete: ${result.inserted} inserted, ${result.skipped} skipped (duplicates)`);
    return result;
  }
}
