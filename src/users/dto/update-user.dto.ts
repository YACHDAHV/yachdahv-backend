import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { PROFILE_GENDERS } from "../gender";

class PhotoDto {
  @IsString()
  @MaxLength(240)
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsBoolean()
  primary?: boolean;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsInt() @Min(18) @Max(100) age?: number;
  @IsOptional() @IsIn(PROFILE_GENDERS) gender?: string;
  @IsOptional() @IsString() @MaxLength(80) occupation?: string;
  @IsOptional() @IsString() @MaxLength(60) country?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(200) bio?: string;
  @IsOptional() @IsString() @MaxLength(100) church?: string;
  @IsOptional() @IsString() @MaxLength(80) intention?: string;
  @IsOptional() @IsString() @MaxLength(300) lookingFor?: string;
  @IsOptional() @IsString() @MaxLength(60) children?: string;
  @IsOptional() @IsString() @MaxLength(100) education?: string;
  @IsOptional() @IsString() @MaxLength(80) denomination?: string;
  @IsOptional() @IsInt() @Min(100) @Max(250) heightCm?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) interests?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PhotoDto) photos?: PhotoDto[];
}

export class UpdatePreferencesDto {
  @IsOptional() @IsInt() @Min(18) @Max(100) minAge?: number;
  @IsOptional() @IsInt() @Min(18) @Max(100) maxAge?: number;
  @IsOptional() @IsString() @MaxLength(80) location?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10000) maxDistanceKm?: number;
  @IsOptional() @IsString() @MaxLength(100) education?: string;
}
