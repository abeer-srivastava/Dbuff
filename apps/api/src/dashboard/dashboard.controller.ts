import { Controller, Get } from "@nestjs/common";
import { DashboardService } from "./dashboard.service.js";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get("pattern-completion") patternCompletion() { return this.dashboard.patternCompletion(); }
  @Get("weakest-patterns") weakestPatterns() { return this.dashboard.weakestPatterns(); }
  @Get("stats") stats() { return this.dashboard.stats(); }
}
