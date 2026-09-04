import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { LeetCodeProblemsQueryDto } from "./dto/leetcode-query.dto.js";

@Injectable()
export class LeetCodeClient {
  private readonly logger = new Logger(LeetCodeClient.name);

  private baseUrl(): string {
    const url = process.env.LEETCODE_API_URL?.trim();
    if (!url) {
      this.logger.warn("LEETCODE_API_URL not set; LeetCode integration disabled");
      throw new HttpException("LeetCode integration is not configured (LEETCODE_API_URL)", HttpStatus.SERVICE_UNAVAILABLE);
    }
    return url.replace(/\/+$/, "");
  }

  private async get<T = unknown>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl()}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
      }
    }
    let response: Response;
    try {
      response = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
    } catch (error) {
      this.logger.warn(`LeetCode API request ${url.pathname} failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new HttpException("LeetCode API is unreachable", HttpStatus.BAD_GATEWAY);
    }
    if (response.status === 404) throw new HttpException("LeetCode resource was not found", HttpStatus.NOT_FOUND);
    if (response.status === 429) throw new HttpException("LeetCode API rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    if (!response.ok) {
      this.logger.warn(`LeetCode API returned HTTP ${response.status} for ${url.pathname}`);
      throw new HttpException(`LeetCode API error (HTTP ${response.status})`, HttpStatus.BAD_GATEWAY);
    }
    const body = (await response.json()) as Record<string, unknown> & { errors?: { message?: string }[] };
    if (Array.isArray(body?.errors)) {
      if (body.errors.some((error) => /does not exist|not found/i.test(error?.message ?? ""))) {
        throw new HttpException("LeetCode resource was not found", HttpStatus.NOT_FOUND);
      }
      this.logger.warn(`LeetCode API returned upstream errors for ${url.pathname}`);
      throw new HttpException("LeetCode API returned an upstream error", HttpStatus.BAD_GATEWAY);
    }
    return body as T;
  }

  profile(username: string) { return this.get(`/${encodeURIComponent(username)}/profile`); }
  solved(username: string) { return this.get(`/${encodeURIComponent(username)}/solved`); }
  acSubmissions(username: string, limit = 20) { return this.get(`/${encodeURIComponent(username)}/acSubmission`, { limit }); }
  calendar(username: string, year?: number) { return this.get(`/${encodeURIComponent(username)}/calendar`, { year }); }
  skillStats(username: string) { return this.get(`/${encodeURIComponent(username)}/skill`); }
  languageStats(username: string) { return this.get(`/${encodeURIComponent(username)}/language`); }
  badges(username: string) { return this.get(`/${encodeURIComponent(username)}/badges`); }
  contestHistory(username: string) { return this.get(`/${encodeURIComponent(username)}/contest/history`); }

  dailyProblem() { return this.get("/daily"); }
  problem(titleSlug: string) { return this.get("/select", { titleSlug }); }
  officialSolution(titleSlug: string) { return this.get("/officialSolution", { titleSlug }); }
  problems(query: LeetCodeProblemsQueryDto) { return this.get("/problems", { ...query }); }

  trendingDiscussions(first = 20) { return this.get("/trendingDiscuss", { first }); }
  discussionTopic(topicId: number) { return this.get(`/discussTopic/${topicId}`); }
  discussionComments(topicId: number) { return this.get(`/discussComments/${topicId}`); }
}