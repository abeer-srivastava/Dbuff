import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service.js";
import { CLEANUP_QUEUE } from "../queue-names.js";

export interface CleanupJobData {
  retentionDays?: number;
}

const DEFAULT_RETENTION_DAYS = 30;

@Processor(CLEANUP_QUEUE)
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<CleanupJobData>): Promise<{ removed: number; retentionDays: number }> {
    const retentionDays = job.data.retentionDays ?? DEFAULT_RETENTION_DAYS;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.ingestionStaging.deleteMany({ where: { fetchedAt: { lt: cutoff } } });
    this.logger.log(`Staging cleanup removed ${count} rows older than ${retentionDays} days`);
    return { removed: count, retentionDays };
  }
}
