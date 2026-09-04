import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { GfgRssClient } from "../src/ingestion/clients/gfg-rss.client.js";

describe("GfgRssClient", () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.GFG_RSS_URL;

  beforeEach(() => {
    process.env.GFG_RSS_URL = "https://www.geeksforgeeks.org/feed/";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.GFG_RSS_URL;
    else process.env.GFG_RSS_URL = originalUrl;
  });

  it("returns an empty list when the feed URL is not configured", async () => {
    delete process.env.GFG_RSS_URL;
    const client = new GfgRssClient();
    expect(await client.fetchFeed()).toEqual([]);
  });

  it("parses RSS item entries, stripping HTML and decoding entities", async () => {
    const feedXml = `<?xml version="1.0"?><rss><channel>
      <item><title>Google OA Experience</title><link>https://www.geeksforgeeks.org/google-oa/</link><description><![CDATA[<p>Had a &quot;hard&quot; array question &amp; a graph problem.</p>]]></description></item>
      <item><title>Amazon Interview Loop</title><link>https://www.geeksforgeeks.org/amazon-loop/</link><description>Simple text summary here.</description></item>
      <item><title>No Link Item</title><description>This one lacks a link and should be skipped.</description></item>
    </channel></rss>`;
    globalThis.fetch = mock(async () => new Response(feedXml, { status: 200 })) as unknown as typeof fetch;
    const client = new GfgRssClient();
    const items = await client.fetchFeed();
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Google OA Experience");
    expect(items[0].sourceLink).toBe("https://www.geeksforgeeks.org/google-oa/");
    expect(items[0].excerpt).toContain('"hard" array question & a graph problem');
    expect(items[1].title).toBe("Amazon Interview Loop");
  });

  it("returns an empty list and logs when the feed returns 404", async () => {
    globalThis.fetch = mock(async () => new Response("Not Found", { status: 404 })) as unknown as typeof fetch;
    const client = new GfgRssClient();
    expect(await client.fetchFeed()).toEqual([]);
  });

  it("caps the excerpt at 400 characters", async () => {
    const longText = "word ".repeat(200);
    const feedXml = `<rss><channel><item><title>T</title><link>https://www.geeksforgeeks.org/long/</link><description>${longText.trim()}</description></item></channel></rss>`;
    globalThis.fetch = mock(async () => new Response(feedXml, { status: 200 })) as unknown as typeof fetch;
    const client = new GfgRssClient();
    const items = await client.fetchFeed();
    expect(items[0].excerpt.length).toBeLessThanOrEqual(401);
  });
});
