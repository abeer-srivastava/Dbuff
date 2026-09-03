import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { CreateProblemDto } from "./dto/create-problem.dto.js";
import { CreateSolutionDto } from "./dto/create-solution.dto.js";
import { ProblemQueryDto } from "./dto/problem-query.dto.js";
import { SeedImportDto } from "./dto/seed-import.dto.js";
import { UpdateProblemDto } from "./dto/update-problem.dto.js";
import { ProblemsService } from "./problems.service.js";

@Controller()
export class ProblemsController {
  constructor(private readonly problems: ProblemsService) {}
  @Get("problems") findAll(@Query() query: ProblemQueryDto) { return this.problems.findAll(query); }
  @Post("problems/seed-import") seedImport(@Body() dto: SeedImportDto) { return this.problems.seedImport(dto); }
  @Get("problems/:id") findOne(@Param("id", ParseIntPipe) id: number) { return this.problems.findOne(id); }
  @Post("problems") create(@Body() dto: CreateProblemDto) { return this.problems.create(dto); }
  @Patch("problems/:id") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateProblemDto) { return this.problems.update(id, dto); }
  @Delete("problems/:id") @HttpCode(200) remove(@Param("id", ParseIntPipe) id: number) { return this.problems.remove(id); }
  @Post("problems/:id/solutions") addSolution(@Param("id", ParseIntPipe) id: number, @Body() dto: CreateSolutionDto) { return this.problems.addSolution(id, dto); }
  @Get("problems/:id/solutions") listSolutions(@Param("id", ParseIntPipe) id: number) { return this.problems.listSolutions(id); }
  @Delete("solutions/:id") @HttpCode(200) deleteSolution(@Param("id", ParseIntPipe) id: number) { return this.problems.deleteSolution(id); }
}
