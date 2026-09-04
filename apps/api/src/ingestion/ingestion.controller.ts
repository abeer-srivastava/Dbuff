import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { PromoteStagingDto, StagingQueryDto } from "./dto/staging.dto.js";
import { IngestionService } from "./ingestion.service.js";

@Controller("ingestion")
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}
  @Get("staging") listStaging(@Query() query: StagingQueryDto) { return this.ingestion.listStaging(query); }
  @Post("staging/:id/promote") promote(@Param("id", ParseIntPipe) id: number, @Body() dto: PromoteStagingDto) { return this.ingestion.promote(id, dto); }
  @Delete("staging/:id") @HttpCode(200) discard(@Param("id", ParseIntPipe) id: number) { return this.ingestion.discard(id); }
}
