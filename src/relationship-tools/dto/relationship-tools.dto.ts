import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { DEVOTIONAL_PLAN_IDS } from "../devotional-plans";

export class SaveReflectionDto {
  @IsOptional() @IsIn(DEVOTIONAL_PLAN_IDS) planId?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(6) day!: number;
  @IsString() @MinLength(1) @MaxLength(500) body!: string;
}

export class SetDevotionalDayDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(6) day!: number;
}

export class ToggleTopicDto {
  @IsString() @MinLength(1) @MaxLength(100) topicKey!: string;
}

export class SaveTopicResponseDto {
  @IsString() @MinLength(1) @MaxLength(100) topicKey!: string;
  @IsString() @MinLength(1) @MaxLength(1000) body!: string;
}

export class StartPlanDto {
  @IsIn(DEVOTIONAL_PLAN_IDS) planId!: string;
}
