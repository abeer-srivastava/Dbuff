import { Module } from "@nestjs/common";
import { IngestionController } from "./ingestion.controller.js";
import { IngestionService } from "./ingestion.service.js";
import { GfgRssClient } from "./clients/gfg-rss.client.js";
import { RedditClient } from "./clients/reddit.client.js";
import { IngestionJobs } from "./ingestion.jobs.js";

@Module({
  controllers: [IngestionController],
  providers: [IngestionService, IngestionJobs, RedditClient, GfgRssClient],
  exports: [IngestionService],
})
export class IngestionModule {}
