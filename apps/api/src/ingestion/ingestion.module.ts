import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { IngestionController } from "./ingestion.controller.js";
import { IngestionService } from "./ingestion.service.js";
import { GfgRssClient } from "./clients/gfg-rss.client.js";
import { RedditClient } from "./clients/reddit.client.js";
import { CLEANUP_QUEUE, GFG_QUEUE, REDDIT_QUEUE } from "./queue-names.js";
import { RedditProcessor } from "./processors/reddit.processor.js";
import { GfgProcessor } from "./processors/gfg.processor.js";
import { CleanupProcessor } from "./processors/cleanup.processor.js";
import { IngestionScheduler } from "./scheduler/ingestion.scheduler.js";

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => {
        const url = process.env.REDIS_URL?.trim();
        if (!url) {
          return { connection: { host: "localhost", port: 6379, enableOfflineQueue: false }, prefix: "dbuff" };
        }
        const parsed = new URL(url);
        return {
          connection: {
            host: parsed.hostname,
            port: parsed.port ? Number(parsed.port) : 6379,
            password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
            db: parsed.pathname && parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : undefined,
            enableOfflineQueue: false,
          },
          prefix: "dbuff",
        };
      },
    }),
    BullModule.registerQueue(
      { name: REDDIT_QUEUE },
      { name: GFG_QUEUE },
      { name: CLEANUP_QUEUE },
    ),
  ],
  controllers: [IngestionController],
  providers: [
    IngestionService,
    IngestionScheduler,
    RedditProcessor,
    GfgProcessor,
    CleanupProcessor,
    RedditClient,
    GfgRssClient,
  ],
  exports: [IngestionService],
})
export class IngestionModule {}
