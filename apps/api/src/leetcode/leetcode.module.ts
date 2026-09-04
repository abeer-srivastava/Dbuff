import { Module } from "@nestjs/common";
import { LeetCodeClient } from "./leetcode.client.js";
import { LeetCodeController } from "./leetcode.controller.js";

@Module({
  controllers: [LeetCodeController],
  providers: [LeetCodeClient],
  exports: [LeetCodeClient],
})
export class LeetcodeModule {}