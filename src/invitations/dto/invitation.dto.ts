import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsEmail, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

const INVITE_CODE_BODY = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function normalizeInviteCode(value: unknown) {
  if (typeof value !== "string") return value;
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = compact.match(new RegExp(`YDV[${INVITE_CODE_BODY}]{12}`));
  if (!match) return compact;
  const body = match[0].slice(3);
  return `YDV-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

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

export class RequestWaitlistInviteDto {
  @IsOptional() @IsUUID() churchId?: string;
}

export class ValidateWaitlistInviteDto {
  @IsUUID() churchId!: string;

  @Transform(({ value }) => normalizeInviteCode(value))
  @IsString()
  @MinLength(8)
  @MaxLength(30)
  @Matches(/^YDV-[23456789A-HJ-NP-Z]{4}-[23456789A-HJ-NP-Z]{4}-[23456789A-HJ-NP-Z]{4}$/, {
    message: "Enter the invitation code exactly as it appears in your email",
  })
  code!: string;
}
