import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller.js";
import { AuthModule } from "./auth/auth.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { ExportModule } from "./export/export.module.js";
import { PatternsModule } from "./patterns/patterns.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { ProblemsModule } from "./problems/problems.module.js";
import { RedisModule } from "./redis/redis.module.js";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, RedisModule, AuthModule, PatternsModule, ProblemsModule, DashboardModule, ExportModule],
  controllers: [AppController],
})
export class AppModule {}
