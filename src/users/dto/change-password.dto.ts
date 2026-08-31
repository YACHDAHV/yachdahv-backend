import { IsString, Matches, MaxLength, MinLength } from "class-validator";

const STRONG_PASSWORD = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;
const STRONG_PASSWORD_MESSAGE = "Password must include a letter, number, and special character";

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(STRONG_PASSWORD, { message: STRONG_PASSWORD_MESSAGE })
  newPassword!: string;
}
