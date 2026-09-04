import { Injectable, Logger } from "@nestjs/common";

export interface GfgRssItem {
  sourceLink: string;
  title: string;
  excerpt: string;
}

@Injectable()
export class GfgRssClient {
  private readonly logger = new Logger(GfgRssClient.name);

  private feedUrl(): string | null {
    const url = process.env.GFG_RSS_URL?.trim();
    if (!url) {
      this.logger.warn("GFG_RSS_URL not set; GfG ingestion disabled");
      return null;
    }
    return url;
  }

  async fetchFeed(): Promise<GfgRssItem[]> {
    const url = this.feedUrl();
    if (!url) return [];
    try {
      const response = await fetch(url, { headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" } });
      if (!response.ok) {
        this.logger.error(`GfG RSS feed returned HTTP ${response.status}` + (response.status === 404 ? ` (URL may have moved): ${url}` : ""));
        return [];
      }
      const xml = await response.text();
      return this.parseRss(xml);
    } catch (error) {
      this.logger.error(`GfG RSS fetch error: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private parseRss(xml: string): GfgRssItem[] {
    const items: GfgRssItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = this.extractTag(block, "title");
      const link = this.extractTag(block, "link");
      const description = this.decodeEntities(this.stripHtml(this.extractTag(block, "description")));
      if (!link || !title) continue;
      items.push({ sourceLink: link, title: title.trim(), excerpt: this.makeExcerpt(description) });
    }
    return items;
  }

  private extractTag(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const match = regex.exec(xml);
    return match ? this.decodeEntities(match[1].trim()) : "";
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  private decodeEntities(input: string): string {
    return input
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  private makeExcerpt(text: string): string {
    return text.length > 400 ? `${text.slice(0, 400)}…` : text;
  }
}
