import { IsInt, IsOptional, IsDateString, Max, Min } from "class-validator";

export class CreateReviewDto {
  @IsInt() @Min(1) @Max(5) confidenceAtReview!: number;
  @IsOptional() @IsDateString() reviewedAt?: string;
}

export class ReviewQueryDto {
  @IsOptional() @IsDateString() date?: string;
}
