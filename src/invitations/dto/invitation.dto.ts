import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsEmail, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

export class CreateChurchDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
}

export class UpdateChurchDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateWaitlistInviteDto {
  @IsEmail() @MaxLength(160) email!: string;
  @IsOptional() @IsUUID() churchId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90) expiresInDays = 14;
}

export class WaitlistEntryDto {
  @IsEmail() @MaxLength(160) email!: string;
  @IsOptional() @IsUUID() churchId?: string;
}

export class BatchWaitlistInviteDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => WaitlistEntryDto)
  entries!: WaitlistEntryDto[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90) expiresInDays = 14;
}

export class ValidateWaitlistInviteDto {
  @IsUUID() churchId!: string;
  @IsString() @MinLength(8) @MaxLength(30) code!: string;
}
