import { IsIn, IsString, MaxLength } from "class-validator";

export class CreateUploadDto {
  @IsString()
  @IsIn(["profile-photo", "identity-document", "identity-selfie"])
  purpose!: "profile-photo" | "identity-document" | "identity-selfie";

  @IsString()
  @IsIn(["image/jpeg", "image/png", "image/webp", "application/pdf"])
  contentType!: string;

  @IsString()
  @MaxLength(120)
  fileName!: string;
}
