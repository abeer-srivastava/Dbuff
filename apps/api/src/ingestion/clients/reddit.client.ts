import { Injectable, Logger } from "@nestjs/common";

export interface RedditPost {
  sourceLink: string;
  title: string;
  excerpt: string;
}

const SUBREDDITS = ["leetcode", "csMajors", "cscareerquestions"];
// Keyword variants are matched as whole words (word boundaries) to avoid false
// positives like "boat"/"coach" for the short "OA" keyword.
const PATTERNS = [
  /\boa\b|\bonline\s+assessment\b|\bcoding\s+round\b|\binterview\s+experience\b|\binterview\s+loop\b|\binterview\s+process\b|\binterview\s+round\b|\btake[- ]?home(?: assessment)?\b/i,
];

@Injectable()
export class RedditClient {
  private readonly logger = new Logger(RedditClient.name);
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  private config(): { clientId: string; secret: string; userAgent: string } | null {
    const clientId = process.env.REDDIT_CLIENT_ID?.trim();
    const secret = process.env.REDDIT_CLIENT_SECRET?.trim();
    if (!clientId || !secret) {
      this.logger.warn("REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set; Reddit ingestion disabled");
      return null;
    }
    return { clientId, secret, userAgent: process.env.REDDIT_USER_AGENT ?? "dbuff-app/1.0" };
  }

  private async ensureToken(): Promise<boolean> {
    const config = this.config();
    if (!config) return false;
    if (this.accessToken && Date.now() < this.tokenExpiresAt) return true;
    try {
      const response = await fetch("https://www.reddit.com/api/v1/access_token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.secret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": config.userAgent,
        },
        body: "grant_type=client_credentials",
      });
      if (!response.ok) {
        this.logger.warn(`Reddit token request failed: HTTP ${response.status}`);
        return false;
      }
      const data = (await response.json()) as { access_token?: string; expires_in?: number };
      if (!data.access_token) {
        this.logger.warn("Reddit token request returned no access_token");
        return false;
      }
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000;
      return true;
    } catch (error) {
      this.logger.warn(`Reddit token request error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async fetchNewPosts(): Promise<RedditPost[]> {
    if (!(await this.ensureToken())) return [];
    const posts: RedditPost[] = [];
    for (const subreddit of SUBREDDITS) {
      const fetched = await this.fetchSubreddit(subreddit);
      posts.push(...fetched);
    }
    return posts;
  }

  private async fetchSubreddit(subreddit: string, after?: string): Promise<RedditPost[]> {
    const config = this.config();
    if (!config) return [];
    const url = new URL(`https://oauth.reddit.com/r/${subreddit}/new`);
    url.searchParams.set("limit", "50");
    if (after) url.searchParams.set("after", after);
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.accessToken}`, "User-Agent": config.userAgent },
    });
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 60);
      this.logger.warn(`Reddit rate limited (429); backing off ${retryAfter}s`);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return [];
    }
    if (!response.ok) {
      this.logger.warn(`Reddit fetch for r/${subreddit} failed: HTTP ${response.status}`);
      return [];
    }
    const data = (await response.json()) as { data?: { children?: { data?: { permalink?: string; title?: string; selftext?: string } }[]; after?: string | null } };
    if (!data.data?.children) return [];
    const matched: RedditPost[] = [];
    for (const child of data.data.children) {
      const post = child.data;
      if (!post?.permalink || !post.title) continue;
      const haystack = `${post.title} ${post.selftext ?? ""}`;
      if (!PATTERNS.some((pattern) => pattern.test(haystack))) continue;
      matched.push({
        sourceLink: `https://www.reddit.com${post.permalink}`,
        title: post.title,
        excerpt: this.makeExcerpt(post.selftext ?? ""),
      });
    }
    return matched;
  }

  private makeExcerpt(text: string): string {
    const cleaned = text.replace(/\s+/g, " ").trim();
    return cleaned.length > 400 ? `${cleaned.slice(0, 400)}…` : cleaned;
  }
}
