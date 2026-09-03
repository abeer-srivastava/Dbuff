import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { CreatePatternDto } from "./dto/create-pattern.dto.js";
import { UpdatePatternDto } from "./dto/update-pattern.dto.js";

@Injectable()
export class PatternsService {
  constructor(private readonly prisma: PrismaService) {}
  findAll() { return this.prisma.pattern.findMany({ include: { _count: { select: { primaryProblems: true, secondaryProblems: true } } }, orderBy: { name: "asc" } }); }
  async findOne(id: number) {
    const pattern = await this.prisma.pattern.findUnique({ where: { id }, include: { _count: { select: { primaryProblems: true, secondaryProblems: true } } } });
    if (!pattern) throw new NotFoundException(`Pattern ${id} was not found`);
    return pattern;
  }
  create(dto: CreatePatternDto) { return this.prisma.pattern.create({ data: dto }); }
  async update(id: number, dto: UpdatePatternDto) { await this.findOne(id); return this.prisma.pattern.update({ where: { id }, data: dto }); }
  async remove(id: number) {
    const pattern = await this.findOne(id);
    if (pattern._count.primaryProblems || pattern._count.secondaryProblems) throw new ConflictException("A pattern linked to problems cannot be deleted");
    try { return await this.prisma.pattern.delete({ where: { id } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") throw new ConflictException("A pattern linked to records cannot be deleted"); throw error; }
  }
}
