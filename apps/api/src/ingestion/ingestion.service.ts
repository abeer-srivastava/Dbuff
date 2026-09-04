import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { PromoteStagingDto, StagingQueryDto } from "./dto/staging.dto.js";

@Injectable()
export class IngestionService {
  constructor(private readonly prisma: PrismaService) {}

  async listStaging(query: StagingQueryDto) {
    const { page, limit, sourcePlatform, reviewed } = query;
    const conditions: Prisma.IngestionStagingWhereInput[] = [];
    if (sourcePlatform) conditions.push({ sourcePlatform });
    if (reviewed !== undefined && reviewed !== "") conditions.push({ reviewed: reviewed === "true" });
    const where: Prisma.IngestionStagingWhereInput = conditions.length ? { AND: conditions } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ingestionStaging.findMany({ where, orderBy: { fetchedAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      this.prisma.ingestionStaging.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async promote(stagingId: number, dto: PromoteStagingDto) {
    const staging = await this.prisma.ingestionStaging.findUnique({ where: { id: stagingId } });
    if (!staging) throw new NotFoundException(`Staged item ${stagingId} was not found`);

    const { underlyingPatternId, closestLcProblemId, ...fields } = dto;
    const story = await this.prisma.$transaction(async (tx) => {
      const created = await tx.oAStory.create({
        data: {
          ...fields,
          sourceLink: staging.sourceLink,
          sourcePlatform: staging.sourcePlatform,
          ...(underlyingPatternId !== undefined ? { underlyingPattern: { connect: { id: underlyingPatternId } } } : {}),
          ...(closestLcProblemId !== undefined ? { closestLcProblem: { connect: { id: closestLcProblemId } } } : {}),
        },
      });
      await tx.ingestionStaging.update({ where: { id: stagingId }, data: { reviewed: true } });
      await tx.ingestionStaging.delete({ where: { id: stagingId } });
      return created;
    });
    return story;
  }

  async discard(stagingId: number) {
    const staging = await this.prisma.ingestionStaging.findUnique({ where: { id: stagingId } });
    if (!staging) throw new NotFoundException(`Staged item ${stagingId} was not found`);
    return this.prisma.ingestionStaging.delete({ where: { id: stagingId } });
  }
}
