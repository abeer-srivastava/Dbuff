import { Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

export interface IngestedItem {
  sourceLink: string;
  title: string;
  excerpt: string;
}

export async function insertPosts(prisma: PrismaService, posts: IngestedItem[], platform: "reddit" | "gfg"): Promise<{ inserted: number; skipped: number }> {
  const logger = new Logger("IngestionInsert");
  let inserted = 0;
  let skipped = 0;
  for (const post of posts) {
    try {
      await prisma.ingestionStaging.create({
        data: {
          sourcePlatform: platform,
          sourceLink: post.sourceLink,
          rawTitle: post.title?.slice(0, 300) ?? null,
          rawExcerpt: post.excerpt?.slice(0, 400) ?? null,
        },
      });
      inserted += 1;
    } catch (error) {
      if (isUniqueViolation(error)) {
        skipped += 1;
      } else {
        logger.warn(`Failed to stage item ${post.sourceLink}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return { inserted, skipped };
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}
