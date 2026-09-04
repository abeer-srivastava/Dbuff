import { Module } from "@nestjs/common";
import { RevisionController } from "./revision.controller.js";
import { RevisionService } from "./revision.service.js";

@Module({ controllers: [RevisionController], providers: [RevisionService], exports: [RevisionService] })
export class RevisionModule {}
