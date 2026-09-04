import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AppController } from "./app.controller.js";
import { AuthModule } from "./auth/auth.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { ExportModule } from "./export/export.module.js";
import { IngestionModule } from "./ingestion/ingestion.module.js";
import { OaStoriesModule } from "./oa-stories/oa-stories.module.js";
import { PatternsModule } from "./patterns/patterns.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { ProblemsModule } from "./problems/problems.module.js";
import { RedisModule } from "./redis/redis.module.js";
import { RevisionModule } from "./revision/revision.module.js";

const appDirectory = dirname(fileURLToPath(import.meta.url));
// Both src/ during development and dist/ after a build sit under apps/api/.
const rootEnvFile = resolve(appDirectory, "../../..", ".env");

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: rootEnvFile }),
    PrismaModule,
    RedisModule,
    AuthModule,
    PatternsModule,
    ProblemsModule,
    DashboardModule,
    ExportModule,
    RevisionModule,
    OaStoriesModule,
    IngestionModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
