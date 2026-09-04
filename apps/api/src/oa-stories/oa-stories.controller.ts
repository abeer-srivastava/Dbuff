import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { CreateOaStoryDto } from "./dto/create-oa-story.dto.js";
import { OaStoryQueryDto } from "./dto/oa-story-query.dto.js";
import { UpdateOaStoryDto } from "./dto/update-oa-story.dto.js";
import { OaStoriesService } from "./oa-stories.service.js";

@Controller()
export class OaStoriesController {
  constructor(private readonly stories: OaStoriesService) {}
  @Get("oa-stories") findAll(@Query() query: OaStoryQueryDto) { return this.stories.findAll(query); }
  @Get("oa-stories/:id") findOne(@Param("id", ParseIntPipe) id: number) { return this.stories.findOne(id); }
  @Post("oa-stories") create(@Body() dto: CreateOaStoryDto) { return this.stories.create(dto); }
  @Patch("oa-stories/:id") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateOaStoryDto) { return this.stories.update(id, dto); }
  @Delete("oa-stories/:id") @HttpCode(200) remove(@Param("id", ParseIntPipe) id: number) { return this.stories.remove(id); }
}
