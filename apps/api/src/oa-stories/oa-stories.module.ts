import { Module } from "@nestjs/common";
import { OaStoriesController } from "./oa-stories.controller.js";
import { OaStoriesService } from "./oa-stories.service.js";

@Module({ controllers: [OaStoriesController], providers: [OaStoriesService], exports: [OaStoriesService] })
export class OaStoriesModule {}
