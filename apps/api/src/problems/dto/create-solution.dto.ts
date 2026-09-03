import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateSolutionDto {
  @IsString() @MaxLength(50) language!: string;
  @IsString() code!: string;
  @IsOptional() @IsString() @MaxLength(100) timeComplexity?: string;
  @IsOptional() @IsString() @MaxLength(100) spaceComplexity?: string;
  @IsOptional() @IsString() @MaxLength(10_000) notes?: string;
}
