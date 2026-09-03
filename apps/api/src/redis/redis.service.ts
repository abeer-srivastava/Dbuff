import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;
  constructor() {
    const url = process.env.REDIS_URL;
    this.client = url ? new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true }) : null;
    this.client?.on("error", (error: Error) => this.logger.warn(`Redis unavailable: ${error.message}`));
  }
  async get<T>(key: string): Promise<T | null> { if (!this.client) return null; const value = await this.client.get(key); return value ? JSON.parse(value) as T : null; }
  async set(key: string, value: unknown, ttlSeconds: number) { if (this.client) await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds); }
  async invalidateByPrefix(prefix: string) {
    if (!this.client) return;
    let cursor = "0";
    do { const [next, keys] = await this.client.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100); cursor = next; if (keys.length) await this.client.del(...keys); } while (cursor !== "0");
  }
  async onModuleDestroy() { await this.client?.quit(); }
}
