import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { CreateReviewDto, ReviewQueryDto } from "./dto/review.dto.js";
import { RevisionService } from "./revision.service.js";

@Controller("revision")
export class RevisionController {
  constructor(private readonly revision: RevisionService) {}
  @Get("queue") queue() { return this.revision.queue(); }
  @Get("daily-recap") dailyRecap(@Query() query: ReviewQueryDto) { return this.revision.dailyRecap(query.date); }
  @Get("weekly-min-coverage") weeklyMinCoverage() { return this.revision.weeklyMinCoverage(); }
  @Post(":problemId/review") review(@Param("problemId", ParseIntPipe) problemId: number, @Body() dto: CreateReviewDto) { return this.revision.review(problemId, dto); }
}
