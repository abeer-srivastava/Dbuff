import { Difficulty, ProblemStatus } from "@prisma/client";
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, ValidateIf } from "class-validator";

export class CreateProblemDto {
  @IsString() @MaxLength(300) title!: string;
  @IsInt() primaryPatternId!: number;
  @IsOptional() @IsInt() lcNumber?: number;
  @IsOptional() @IsUrl() lcUrl?: string;
  @IsOptional() @IsEnum(Difficulty) difficulty?: Difficulty;
  @IsOptional() @IsString() @MaxLength(200) topic?: string;
  @IsOptional() @IsString() @MaxLength(200) sourceSheet?: string;
  @IsOptional() @IsEnum(ProblemStatus) status?: ProblemStatus;
  @IsOptional() @IsInt() @Min(1) @Max(5) confidence?: number;
  @IsOptional() @IsInt() @Min(0) timesRevisited?: number;
  @IsOptional() @IsDateString() dateFirstAttempted?: string;
  @IsOptional() @IsDateString() dateSolved?: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) secondaryPatternIds?: number[];
}
