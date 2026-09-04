import { RoleLevel, SourcePlatform } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from "class-validator";

export class PromoteStagingDto {
  @IsString() @MaxLength(20_000) storySummary!: string;
  @IsOptional() @IsString() @MaxLength(120) company?: string;
  @IsOptional() @IsEnum(RoleLevel) roleLevel?: RoleLevel;
  @IsOptional() @IsInt() underlyingPatternId?: number;
  @IsOptional() @IsInt() closestLcProblemId?: number;
  @IsOptional() @IsString() @MaxLength(10_000) myApproach?: string;
}

export class StagingQueryDto {
  @IsOptional() @IsEnum(SourcePlatform) sourcePlatform?: SourcePlatform;
  @IsOptional() @IsString() reviewed?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
