import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from "class-validator";

const STRONG_PASSWORD = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;
const STRONG_PASSWORD_MESSAGE = "Password must include a letter, number, and special character";

export class RegisterDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(STRONG_PASSWORD, { message: STRONG_PASSWORD_MESSAGE })
  password!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class RequestPhoneCodeDto {
  @IsString()
  @MaxLength(40)
  phone!: string;
}

export class VerifyPhoneDto extends RequestPhoneCodeDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class RequestEmailCodeDto {
  @IsEmail()
  email!: string;
}

export class VerifyEmailDto extends RequestEmailCodeDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(STRONG_PASSWORD, { message: STRONG_PASSWORD_MESSAGE })
  password!: string;
}
