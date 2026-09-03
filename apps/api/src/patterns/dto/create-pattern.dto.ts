import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreatePatternDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}
