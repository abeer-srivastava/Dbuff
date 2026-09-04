import { RoleLevel, SourcePlatform } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class UpdateOaStoryDto {
  @IsOptional() @IsString() @MaxLength(120) company?: string;
  @IsOptional() @IsEnum(RoleLevel) roleLevel?: RoleLevel;
  @IsOptional() @IsUrl() sourceLink?: string;
  @IsOptional() @IsEnum(SourcePlatform) sourcePlatform?: SourcePlatform;
  @IsOptional() @IsString() @MaxLength(20_000) storySummary?: string;
  @IsOptional() @IsInt() underlyingPatternId?: number;
  @IsOptional() @IsInt() closestLcProblemId?: number;
  @IsOptional() @IsString() @MaxLength(10_000) myApproach?: string;
}
