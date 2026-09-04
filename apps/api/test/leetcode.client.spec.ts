import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { HttpException, HttpStatus } from "@nestjs/common";
import { LeetCodeClient } from "../src/leetcode/leetcode.client.js";

describe("LeetCodeClient", () => {
  const originalFetch = globalThis.fetch;
  const envBackup = process.env.LEETCODE_API_URL;

  beforeEach(() => {
    process.env.LEETCODE_API_URL = "http://localhost:3005";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (envBackup === undefined) delete process.env.LEETCODE_API_URL;
    else process.env.LEETCODE_API_URL = envBackup;
  });

  it("returns 503 when LEETCODE_API_URL is not configured", async () => {
    delete process.env.LEETCODE_API_URL;
    const client = new LeetCodeClient();
    try {
      await client.profile("foo");
      expect.unreachable("expected an exception");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    }
  });

  it("fetches a user profile from the configured base URL", async () => {
    const fetchMock = mock(async (url: string | URL) => new Response(JSON.stringify({ username: "alfa", totalSolved: 42 }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const client = new LeetCodeClient();
    const result = await client.profile("alfa");
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://localhost:3005/alfa/profile");
    expect(result).toEqual({ username: "alfa", totalSolved: 42 });
  });

  it("passes query parameters through for submissions, calendar, and discussions", async () => {
    const seen: string[] = [];
    const fetchMock = mock(async (url: string | URL) => {
      seen.push(String(url));
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    const client = new LeetCodeClient();
    await client.acSubmissions("alfa", 7);
    await client.calendar("alfa", 2025);
    await client.trendingDiscussions(10);
    expect(seen[0]).toBe("http://localhost:3005/alfa/acSubmission?limit=7");
    expect(seen[1]).toBe("http://localhost:3005/alfa/calendar?year=2025");
    expect(seen[2]).toBe("http://localhost:3005/trendingDiscuss?first=10");
  });

  it("maps upstream HTTP 404 to a 404 response", async () => {
    const fetchMock = mock(async () => new Response("Not found", { status: 404 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    const client = new LeetCodeClient();
    try {
      await client.profile("does-not-exist");
      expect.unreachable("expected an exception");
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
  });

  it("treats an embedded \"user does not exist\" error as 404", async () => {
    const body = JSON.stringify({ errors: [{ message: "That user does not exist." }], data: { matchedUser: null } });
    const fetchMock = mock(async () => new Response(body, { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    const client = new LeetCodeClient();
    try {
      await client.profile("does-not-exist");
      expect.unreachable("expected an exception");
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
  });

  it("returns 502 when the upstream API is unreachable", async () => {
    const fetchMock = mock(async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    const client = new LeetCodeClient();
    try {
      await client.dailyProblem();
      expect.unreachable("expected an exception");
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    }
  });
});