import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";
import { CreateOaStoryDto } from "./dto/create-oa-story.dto.js";
import { OaStoryQueryDto } from "./dto/oa-story-query.dto.js";
import { UpdateOaStoryDto } from "./dto/update-oa-story.dto.js";

const detailInclude = { underlyingPattern: true, closestLcProblem: { select: { id: true, title: true, lcNumber: true } } } as const;

@Injectable()
export class OaStoriesService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  async findAll(query: OaStoryQueryDto) {
    const { page, limit, company, pattern, problem, roleLevel, sourcePlatform, q } = query;
    const conditions: Prisma.OAStoryWhereInput[] = [];
    if (company) conditions.push({ company: { contains: company, mode: "insensitive" } });
    if (pattern) conditions.push({ underlyingPatternId: pattern });
    if (problem) conditions.push({ closestLcProblemId: problem });
    if (roleLevel) conditions.push({ roleLevel });
    if (sourcePlatform) conditions.push({ sourcePlatform });
    if (q) conditions.push({ OR: [{ storySummary: { contains: q, mode: "insensitive" } }, { myApproach: { contains: q, mode: "insensitive" } }, { company: { contains: q, mode: "insensitive" } }] });
    const where: Prisma.OAStoryWhereInput = conditions.length ? { AND: conditions } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.oAStory.findMany({ where, include: detailInclude, orderBy: { dateAdded: "desc" }, skip: (page - 1) * limit, take: limit }),
      this.prisma.oAStory.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: number) {
    const story = await this.prisma.oAStory.findUnique({ where: { id }, include: detailInclude });
    if (!story) throw new NotFoundException(`OA story ${id} was not found`);
    return story;
  }

  async create(dto: CreateOaStoryDto) {
    const story = await this.prisma.oAStory.create({ data: this.toCreateData(dto), include: detailInclude });
    await this.redis.invalidateByPrefix("dashboard:");
    return story;
  }

  async update(id: number, dto: UpdateOaStoryDto) {
    await this.findOne(id);
    const story = await this.prisma.oAStory.update({ where: { id }, data: this.toUpdateData(dto), include: detailInclude });
    await this.redis.invalidateByPrefix("dashboard:");
    return story;
  }

  async remove(id: number) {
    await this.findOne(id);
    const result = await this.prisma.oAStory.delete({ where: { id } });
    await this.redis.invalidateByPrefix("dashboard:");
    return result;
  }

  private toCreateData(dto: CreateOaStoryDto): Prisma.OAStoryCreateInput {
    const { underlyingPatternId, closestLcProblemId, ...fields } = dto;
    return {
      ...fields,
      ...(underlyingPatternId !== undefined ? { underlyingPattern: { connect: { id: underlyingPatternId } } } : {}),
      ...(closestLcProblemId !== undefined ? { closestLcProblem: { connect: { id: closestLcProblemId } } } : {}),
    };
  }

  private toUpdateData(dto: UpdateOaStoryDto): Prisma.OAStoryUpdateInput {
    const { underlyingPatternId, closestLcProblemId, ...fields } = dto;
    return {
      ...fields,
      ...(underlyingPatternId !== undefined ? { underlyingPattern: { connect: { id: underlyingPatternId } } } : {}),
      ...(closestLcProblemId !== undefined ? { closestLcProblem: { connect: { id: closestLcProblemId } } } : {}),
    };
  }
}
