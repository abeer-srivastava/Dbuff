import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, ValidateNested } from "class-validator";
import { CreateProblemDto } from "./create-problem.dto.js";

export class SeedImportDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => CreateProblemDto) problems!: CreateProblemDto[];
}
