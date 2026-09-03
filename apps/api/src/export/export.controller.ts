import { Controller, Get, Header } from "@nestjs/common";
import { ExportService } from "./export.service.js";

@Controller("export")
export class ExportController {
  constructor(private readonly exporter: ExportService) {}
  @Get() @Header("Content-Disposition", "attachment; filename=dbuff-export.json") exportAll() { return this.exporter.exportAll(); }
}
