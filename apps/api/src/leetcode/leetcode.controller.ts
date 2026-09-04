import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import { LeetCodeClient } from "./leetcode.client.js";
import {
  CalendarQueryDto,
  LeetCodeProblemsQueryDto,
  ProblemQueryDto,
  SubmissionsQueryDto,
  TrendingQueryDto,
} from "./dto/leetcode-query.dto.js";

@Controller("leetcode")
export class LeetCodeController {
  constructor(private readonly client: LeetCodeClient) {}

  @Get("user/:username") profile(@Param("username") username: string) { return this.client.profile(username); }
  @Get("user/:username/solved") solved(@Param("username") username: string) { return this.client.solved(username); }
  @Get("user/:username/submissions") submissions(@Param("username") username: string, @Query() query: SubmissionsQueryDto) { return this.client.acSubmissions(username, query.limit ?? 20); }
  @Get("user/:username/calendar") calendar(@Param("username") username: string, @Query() query: CalendarQueryDto) { return this.client.calendar(username, query.year); }
  @Get("user/:username/skill") skill(@Param("username") username: string) { return this.client.skillStats(username); }
  @Get("user/:username/language") language(@Param("username") username: string) { return this.client.languageStats(username); }
  @Get("user/:username/badges") badges(@Param("username") username: string) { return this.client.badges(username); }
  @Get("user/:username/contest-history") contestHistory(@Param("username") username: string) { return this.client.contestHistory(username); }

  @Get("daily") daily() { return this.client.dailyProblem(); }
  @Get("problem") problem(@Query() query: ProblemQueryDto) { return this.client.problem(query.titleSlug); }
  @Get("solution") solution(@Query() query: ProblemQueryDto) { return this.client.officialSolution(query.titleSlug); }
  @Get("problems") problems(@Query() query: LeetCodeProblemsQueryDto) { return this.client.problems(query); }

  @Get("discussions/trending") trending(@Query() query: TrendingQueryDto) { return this.client.trendingDiscussions(query.first ?? 20); }
  @Get("discussions/:topicId") topic(@Param("topicId", ParseIntPipe) topicId: number) { return this.client.discussionTopic(topicId); }
  @Get("discussions/:topicId/comments") comments(@Param("topicId", ParseIntPipe) topicId: number) { return this.client.discussionComments(topicId); }
}