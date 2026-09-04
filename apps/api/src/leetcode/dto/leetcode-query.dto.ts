import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ProblemQueryDto {
  @IsString() titleSlug!: string;
}

export class LeetCodeProblemsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip?: number;
  @IsOptional() @IsString() tags?: string;
  @IsOptional() @IsEnum(["EASY", "MEDIUM", "HARD"]) difficulty?: "EASY" | "MEDIUM" | "HARD";
}

export class SubmissionsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class CalendarQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) year?: number;
}

export class TrendingQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) first?: number;
}