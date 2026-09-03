import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { CreatePatternDto } from "./dto/create-pattern.dto.js";
import { UpdatePatternDto } from "./dto/update-pattern.dto.js";
import { PatternsService } from "./patterns.service.js";

@Controller("patterns")
export class PatternsController {
  constructor(private readonly patterns: PatternsService) {}
  @Get() findAll() { return this.patterns.findAll(); }
  @Get(":id") findOne(@Param("id", ParseIntPipe) id: number) { return this.patterns.findOne(id); }
  @Post() create(@Body() dto: CreatePatternDto) { return this.patterns.create(dto); }
  @Patch(":id") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdatePatternDto) { return this.patterns.update(id, dto); }
  @Delete(":id") @HttpCode(200) remove(@Param("id", ParseIntPipe) id: number) { return this.patterns.remove(id); }
}
