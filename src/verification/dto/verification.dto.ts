import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class SubmitVerificationDto {
  @IsString()
  @IsIn(["nin", "passport", "drivers_license", "voters_card"])
  documentType!: string;

  @IsString()
  @MaxLength(240)
  documentKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  selfieKey?: string;
}
