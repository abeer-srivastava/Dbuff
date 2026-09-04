import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Queue } from "bullmq";
import { CLEANUP_QUEUE, GFG_QUEUE, REDDIT_QUEUE } from "../queue-names.js";

@Injectable()
export class IngestionScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(IngestionScheduler.name);

  constructor(
    @InjectQueue(REDDIT_QUEUE) private readonly redditQueue: Queue,
    @InjectQueue(GFG_QUEUE) private readonly gfgQueue: Queue,
    @InjectQueue(CLEANUP_QUEUE) private readonly cleanupQueue: Queue,
  ) {}

  async onApplicationBootstrap() {
    await this.schedule(this.redditQueue, "reddit-schedule", { pattern: "0 */6 * * *" }, "reddit", {});
    await this.schedule(this.gfgQueue, "gfg-schedule", { pattern: "0 6 * * *" }, "gfg", {});
    await this.schedule(this.cleanupQueue, "cleanup-schedule", { pattern: "0 3 * * *" }, "cleanup", { retentionDays: 30 });
  }

  private async schedule(queue: Queue, jobSchedulerId: string, repeat: { pattern: string }, name: string, data: Record<string, unknown>) {
    try {
      await queue.upsertJobScheduler(jobSchedulerId, repeat, { name, data });
      this.logger.log(`Scheduled '${name}' job (${repeat.pattern})`);
    } catch (error) {
      this.logger.warn(`Failed to schedule '${name}' job (Redis may be unavailable): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
