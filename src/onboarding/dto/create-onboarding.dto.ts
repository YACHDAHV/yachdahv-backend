import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { PROFILE_GENDERS } from "../../users/gender";
import { PersonalityDto } from "../../users/personality";

export class CreateOnboardingDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(100)
  age?: number;

  @IsOptional()
  @IsString()
  @IsIn(PROFILE_GENDERS)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  occupation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  church?: string;

  @IsOptional()
  @IsUUID()
  churchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  inviteCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  intent?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(100)
  minAge?: number;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(100)
  maxAge?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  maxDistanceKm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  education?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalityDto)
  personality?: PersonalityDto;
}
