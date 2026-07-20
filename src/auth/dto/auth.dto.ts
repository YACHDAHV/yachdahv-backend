import { IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from "class-validator";

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
  password!: string;
}
