import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}
  async exportAll() {
    const [problems, oaStories] = await Promise.all([
      this.prisma.problem.findMany({ include: { primaryPattern: true, secondaryPatterns: { include: { pattern: true } }, solutions: true }, orderBy: { id: "asc" } }),
      this.prisma.oAStory.findMany({ include: { underlyingPattern: true, closestLcProblem: true }, orderBy: { id: "asc" } }),
    ]);
    return { exportedAt: new Date().toISOString(), problems, oaStories };
  }
}
