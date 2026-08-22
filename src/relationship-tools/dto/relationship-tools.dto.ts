import { Type } from "class-transformer";
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class SaveReflectionDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(6) day!: number;
  @IsString() @MinLength(1) @MaxLength(500) body!: string;
}

export class SetDevotionalDayDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(6) day!: number;
}

export class ToggleTopicDto {
  @IsString() @MinLength(1) @MaxLength(100) topicKey!: string;
}
