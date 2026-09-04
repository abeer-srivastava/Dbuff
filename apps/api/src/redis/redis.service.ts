import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.client = null;
      this.logger.warn("REDIS_URL not set; caching disabled");
      return;
    }
    this.client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true, enableOfflineQueue: false });
    this.client.on("error", (error: Error) => this.logger.warn(`Redis unavailable: ${error.message}`));
  }

  async onModuleInit() {
    try {
      await this.client?.connect();
    } catch (error) {
      this.logger.warn(`Redis connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const value = await this.client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      this.logger.warn(`Redis get failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number) {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      this.logger.warn(`Redis set failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async invalidateByPrefix(prefix: string) {
    if (!this.client) return;
    try {
      let cursor = "0";
      do {
        const [next, keys] = await this.client.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
        cursor = next;
        if (keys.length) await this.client.del(...keys);
      } while (cursor !== "0");
    } catch (error) {
      this.logger.warn(`Redis invalidation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
  }
}