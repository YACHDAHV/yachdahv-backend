import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto, LoginDto, RefreshDto, RegisterDto, RequestPhoneCodeDto, ResetPasswordDto, VerifyPhoneDto } from "./dto/auth.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() payload: RegisterDto) { return this.auth.register(payload); }

  @Post("login")
  login(@Body() payload: LoginDto) { return this.auth.login(payload); }

  @Post("refresh")
  refresh(@Body() payload: RefreshDto) { return this.auth.refresh(payload); }

  @Post("logout")
  logout(@Body() payload: RefreshDto) { return this.auth.logout(payload); }

  @Post("phone/request-code")
  requestPhoneCode(@Body() payload: RequestPhoneCodeDto) { return this.auth.requestPhoneCode(payload.phone); }

  @Post("phone/verify")
  verifyPhone(@Body() payload: VerifyPhoneDto) { return this.auth.verifyPhone(payload); }

  @Post("forgot-password")
  forgotPassword(@Body() payload: ForgotPasswordDto) { return this.auth.forgotPassword(payload); }

  @Post("reset-password")
  resetPassword(@Body() payload: ResetPasswordDto) { return this.auth.resetPassword(payload); }
}
