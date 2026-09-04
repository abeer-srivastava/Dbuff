import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProblemStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";
import { CreateProblemDto } from "./dto/create-problem.dto.js";
import { CreateSolutionDto } from "./dto/create-solution.dto.js";
import { ProblemQueryDto } from "./dto/problem-query.dto.js";
import { SeedImportDto } from "./dto/seed-import.dto.js";
import { UpdateProblemDto } from "./dto/update-problem.dto.js";

const detailInclude = { primaryPattern: true, secondaryPatterns: { include: { pattern: true } }, solutions: { orderBy: { createdAt: "desc" } } } as const;

@Injectable()
export class ProblemsService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}
  async findAll(query: ProblemQueryDto) {
    const { page, limit, pattern, status, difficulty, q } = query;
    const conditions: Prisma.ProblemWhereInput[] = [];
    if (pattern) conditions.push({ OR: [{ primaryPatternId: pattern }, { secondaryPatterns: { some: { patternId: pattern } } }] });
    if (status) conditions.push({ status });
    if (difficulty) conditions.push({ difficulty });
    if (q) conditions.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { topic: { contains: q, mode: "insensitive" } }, { solutions: { some: { notes: { contains: q, mode: "insensitive" } } } }] });
    const where: Prisma.ProblemWhereInput = conditions.length ? { AND: conditions } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.problem.findMany({ where, include: { primaryPattern: true, _count: { select: { solutions: true } }, secondaryPatterns: { include: { pattern: true } } }, orderBy: { updatedAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      this.prisma.problem.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
  async findOne(id: number) { const problem = await this.prisma.problem.findUnique({ where: { id }, include: detailInclude }); if (!problem) throw new NotFoundException(`Problem ${id} was not found`); return problem; }
  async create(dto: CreateProblemDto) { try { const problem = await this.prisma.problem.create({ data: this.toCreateData(dto), include: detailInclude }); await this.invalidateDashboard(); return problem; } catch (error) { ProblemsService.assertValidReference(error); } }
  async update(id: number, dto: UpdateProblemDto) {
    await this.findOne(id);
    const { secondaryPatternIds, dateFirstAttempted, dateSolved, ...fields } = dto;
    const data: Prisma.ProblemUpdateInput = { ...fields, ...(dateFirstAttempted !== undefined ? { dateFirstAttempted: new Date(dateFirstAttempted) } : {}), ...(dateSolved !== undefined ? { dateSolved: new Date(dateSolved) } : {}), ...(secondaryPatternIds !== undefined ? { secondaryPatterns: { deleteMany: {}, create: this.uniqueSecondary(secondaryPatternIds, dto.primaryPatternId).map((patternId) => ({ patternId })) } } : {}) };
    try { const problem = await this.prisma.problem.update({ where: { id }, data, include: detailInclude }); await this.invalidateDashboard(); return problem; } catch (error) { ProblemsService.assertValidReference(error); }
  }
  async remove(id: number) { await this.findOne(id); const result = await this.prisma.problem.delete({ where: { id } }); await this.invalidateDashboard(); return result; }
  async addSolution(problemId: number, dto: CreateSolutionDto) { await this.findOne(problemId); try { const solution = await this.prisma.solution.create({ data: { problemId, ...dto } }); await this.invalidateDashboard(); return solution; } catch (error) { ProblemsService.assertValidReference(error); } }
  async listSolutions(problemId: number) { await this.findOne(problemId); return this.prisma.solution.findMany({ where: { problemId }, orderBy: { createdAt: "desc" } }); }
  async deleteSolution(id: number) { const solution = await this.prisma.solution.findUnique({ where: { id } }); if (!solution) throw new NotFoundException(`Solution ${id} was not found`); const result = await this.prisma.solution.delete({ where: { id } }); await this.invalidateDashboard(); return result; }
  async seedImport(dto: SeedImportDto) { try { const created = await this.prisma.$transaction(dto.problems.map((problem) => this.prisma.problem.create({ data: this.toCreateData(problem) }))); await this.invalidateDashboard(); return { created: created.length }; } catch (error) { ProblemsService.assertValidReference(error); } }
  private static assertValidReference(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2025")) {
      throw new BadRequestException("Referenced id does not exist");
    }
    throw error;
  }
  private toCreateData(dto: CreateProblemDto): Prisma.ProblemCreateInput {
    const { primaryPatternId, secondaryPatternIds, dateFirstAttempted, dateSolved, ...fields } = dto;
    return { ...fields, primaryPattern: { connect: { id: primaryPatternId } }, ...(dateFirstAttempted ? { dateFirstAttempted: new Date(dateFirstAttempted) } : {}), ...(dateSolved ? { dateSolved: new Date(dateSolved) } : {}), ...(secondaryPatternIds?.length ? { secondaryPatterns: { create: this.uniqueSecondary(secondaryPatternIds, primaryPatternId).map((patternId) => ({ pattern: { connect: { id: patternId } } })) } } : {}) };
  }
  private uniqueSecondary(ids: number[], primaryId?: number) { return [...new Set(ids)].filter((id) => id !== primaryId); }
  private invalidateDashboard() { return this.redis.invalidateByPrefix("dashboard:"); }
}
