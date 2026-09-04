import { RoleLevel, SourcePlatform } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class OaStoryQueryDto {
  @IsOptional() @IsString() company?: string;
  @IsOptional() @Type(() => Number) @IsInt() pattern?: number;
  @IsOptional() @Type(() => Number) @IsInt() problem?: number;
  @IsOptional() @IsEnum(RoleLevel) roleLevel?: RoleLevel;
  @IsOptional() @IsEnum(SourcePlatform) sourcePlatform?: SourcePlatform;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
