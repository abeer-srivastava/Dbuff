import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { RedditClient } from "../src/ingestion/clients/reddit.client.js";

describe("RedditClient", () => {
  const originalFetch = globalThis.fetch;
  const envBackup = {
    REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET,
    REDDIT_USER_AGENT: process.env.REDDIT_USER_AGENT,
  };

  beforeEach(() => {
    process.env.REDDIT_CLIENT_ID = "test-id";
    process.env.REDDIT_CLIENT_SECRET = "test-secret";
    process.env.REDDIT_USER_AGENT = "dbuff-test/1.0";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("returns an empty list when credentials are not configured", async () => {
    delete process.env.REDDIT_CLIENT_ID;
    delete process.env.REDDIT_CLIENT_SECRET;
    const client = new RedditClient();
    expect(await client.fetchNewPosts()).toEqual([]);
  });

  it("fetches posts across subreddits and keeps only keyword-matched titles", async () => {
    const posts = [
      { permalink: "/r/leetcode/comments/1/oa", title: "Just finished an online assessment for Meta", selftext: "It went okay." },
      { permalink: "/r/leetcode/comments/2/foo", title: "Watch this cool video about boating", selftext: "No signals here, just a dinghy." },
      { permalink: "/r/csMajors/comments/3/interview", title: "Coding round experience at Amazon", selftext: "" },
    ];
    const fetchMock = mock(async (url: string | URL) => {
      if (String(url).startsWith("https://www.reddit.com/api/v1/access_token")) {
        return new Response(JSON.stringify({ access_token: "token123", expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: { children: posts.map((p) => ({ data: p })), after: null } }), { status: 200 });
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    const client = new RedditClient();
    const results = await client.fetchNewPosts();
    // 3 subreddits x 3 posts each, but only OA/interview matching ones kept
    const matchedTitles = results.map((r) => r.title);
    expect(matchedTitles.filter((t) => t.includes("online assessment"))).toHaveLength(3);
    expect(matchedTitles.filter((t) => t.includes("Coding round"))).toHaveLength(3);
    // "boating" contains "oa" but is not a word-boundary match, so it must be excluded
    expect(matchedTitles.filter((t) => t.includes("Watch this cool video"))).toHaveLength(0);
    expect(results.every((r) => r.sourceLink.startsWith("https://www.reddit.com"))).toBe(true);
  });

  it("backs off and returns empties the subreddit on HTTP 429", async () => {
    const fetchMock = mock(async (url: string | URL) => {
      if (String(url).startsWith("https://www.reddit.com/api/v1/access_token")) {
        return new Response(JSON.stringify({ access_token: "token123", expires_in: 3600 }), { status: 200 });
      }
      return new Response("Rate limited", { status: 429, headers: { "retry-after": "0" } });
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    const client = new RedditClient();
    expect(await client.fetchNewPosts()).toEqual([]);
  });
});
