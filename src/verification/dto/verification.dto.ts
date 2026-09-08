import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from "class-validator";

export const VERIFICATION_DOCUMENT_TYPES = ["nin", "passport", "drivers_license", "national_id", "residence_permit", "voters_card"] as const;
export type VerificationDocumentType = (typeof VERIFICATION_DOCUMENT_TYPES)[number];

export class SubmitVerificationDto {
  @IsString()
  @IsIn(VERIFICATION_DOCUMENT_TYPES)
  documentType!: VerificationDocumentType;

  @ValidateIf((payload: SubmitVerificationDto) => payload.documentType === "nin")
  @IsString()
  @Matches(/^\d{11}$/, { message: "NIN must be 11 digits" })
  nin?: string;

  @ValidateIf((payload: SubmitVerificationDto) => payload.documentType !== "nin")
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  @Matches(/^[A-Za-z]{2}$/, { message: "documentCountry must be a 2-letter ISO code" })
  @Transform(({ value }) => typeof value === "string" ? value.toUpperCase() : value)
  documentCountry?: string;

  @ValidateIf((payload: SubmitVerificationDto) => payload.documentType !== "nin")
  @IsString()
  @MaxLength(240)
  documentKey?: string;

  @IsString()
  @MaxLength(240)
  selfieKey!: string;
}
