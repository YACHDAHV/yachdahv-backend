import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { compare, hash } from "bcryptjs";
import { Repository } from "typeorm";
import { PhoneCode, Preference, Profile, RefreshToken, User, UserStatus } from "../database/entities";
import { ForgotPasswordDto, LoginDto, RefreshDto, RegisterDto, ResetPasswordDto, VerifyPhoneDto } from "./dto/auth.dto";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(Preference) private readonly preferences: Repository<Preference>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(PhoneCode) private readonly phoneCodes: Repository<PhoneCode>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(payload: RegisterDto) {
    const email = payload.email.trim().toLowerCase();
    if (await this.users.exists({ where: { email } })) throw new ConflictException("Email is already registered");
    if (payload.phone && await this.users.exists({ where: { phone: payload.phone } })) throw new ConflictException("Phone number is already registered");

    const user = await this.users.manager.transaction(async (manager) => {
      const created = await manager.save(User, manager.create(User, {
        name: payload.name.trim(),
        email,
        phone: payload.phone ?? null,
        passwordHash: await hash(payload.password, 12),
      }));
      await manager.save(Profile, manager.create(Profile, { userId: created.id, interests: [], photos: [] }));
      await manager.save(Preference, manager.create(Preference, { userId: created.id }));
      return created;
    });

    return this.issueSession(user);
  }

  async login(payload: LoginDto) {
    const user = await this.users.createQueryBuilder("user")
      .addSelect("user.passwordHash")
      .where("LOWER(user.email) = LOWER(:email)", { email: payload.email.trim() })
      .getOne();
    if (!user?.passwordHash || !(await compare(payload.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }
    if (user.status === UserStatus.SUSPENDED) throw new UnauthorizedException("Account is suspended");
    if (user.status === UserStatus.DEACTIVATED) throw new UnauthorizedException("Account is deactivated");
    return this.issueSession(user);
  }

  async refresh(payload: RefreshDto) {
    let decoded: { sub: string; tokenId: string; type: string };
    try {
      decoded = await this.jwt.verifyAsync(payload.refreshToken, { secret: this.config.getOrThrow("JWT_REFRESH_SECRET") });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    if (decoded.type !== "refresh") throw new UnauthorizedException("Invalid refresh token");

    const stored = await this.refreshTokens.createQueryBuilder("token")
      .addSelect("token.tokenHash")
      .where("token.id = :id", { id: decoded.tokenId })
      .andWhere("token.userId = :userId", { userId: decoded.sub })
      .getOne();
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date() || !(await compare(payload.refreshToken, stored.tokenHash))) {
      throw new UnauthorizedException("Refresh token has been revoked");
    }
    stored.revokedAt = new Date();
    await this.refreshTokens.save(stored);
    const user = await this.users.findOneByOrFail({ id: decoded.sub });
    return this.issueSession(user);
  }

  async logout(payload: RefreshDto) {
    try {
      const decoded = await this.jwt.verifyAsync<{ tokenId: string }>(payload.refreshToken, { secret: this.config.getOrThrow("JWT_REFRESH_SECRET") });
      await this.refreshTokens.update(decoded.tokenId, { revokedAt: new Date() });
    } catch {
      // Logout remains idempotent for invalid or already-expired tokens.
    }
    return { success: true };
  }

  async requestPhoneCode(phone: string) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.phoneCodes.save(this.phoneCodes.create({
      phone,
      codeHash: await hash(code, 10),
      expiresAt: new Date(Date.now() + 10 * 60_000),
      usedAt: null,
    }));
    return {
      success: true,
      expiresInSeconds: 600,
      ...(this.config.get("NODE_ENV") === "production" ? {} : { developmentCode: code }),
    };
  }

  async verifyPhone(payload: VerifyPhoneDto) {
    const record = await this.phoneCodes.createQueryBuilder("code")
      .addSelect("code.codeHash")
      .where("code.phone = :phone", { phone: payload.phone })
      .andWhere("code.usedAt IS NULL")
      .orderBy("code.createdAt", "DESC")
      .getOne();
    if (!record || record.expiresAt <= new Date() || !(await compare(payload.code, record.codeHash))) {
      throw new UnauthorizedException("Invalid or expired verification code");
    }
    record.usedAt = new Date();
    await this.phoneCodes.save(record);
    await this.users.update({ phone: payload.phone }, { phoneVerified: true });
    return { verified: true, phone: payload.phone };
  }

  async forgotPassword(payload: ForgotPasswordDto) {
    const user = await this.users.findOneBy({ email: payload.email.trim().toLowerCase() });
    if (user) {
      const resetToken = await this.jwt.signAsync({ sub: user.id, type: "password-reset" }, {
        secret: this.config.getOrThrow("JWT_RESET_SECRET"),
        expiresIn: "20m",
      });
      return { success: true, ...(this.config.get("NODE_ENV") === "production" ? {} : { developmentToken: resetToken }) };
    }
    return { success: true };
  }

  async resetPassword(payload: ResetPasswordDto) {
    let decoded: { sub: string; type: string };
    try {
      decoded = await this.jwt.verifyAsync(payload.token, { secret: this.config.getOrThrow("JWT_RESET_SECRET") });
    } catch {
      throw new UnauthorizedException("Invalid or expired reset token");
    }
    if (decoded.type !== "password-reset") throw new UnauthorizedException("Invalid reset token");
    await this.users.update(decoded.sub, { passwordHash: await hash(payload.password, 12) });
    await this.refreshTokens.createQueryBuilder().update(RefreshToken).set({ revokedAt: new Date() })
      .where("user_id = :userId", { userId: decoded.sub })
      .andWhere("revoked_at IS NULL")
      .execute();
    return { success: true };
  }

  private async issueSession(user: User) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, email: user.email ?? undefined, type: "access" },
      { secret: this.config.getOrThrow("JWT_ACCESS_SECRET"), expiresIn: "15m" },
    );
    const tokenRecord = await this.refreshTokens.save(this.refreshTokens.create({
      userId: user.id,
      tokenHash: "pending",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
      revokedAt: null,
    }));
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, tokenId: tokenRecord.id, type: "refresh" },
      { secret: this.config.getOrThrow("JWT_REFRESH_SECRET"), expiresIn: "30d" },
    );
    tokenRecord.tokenHash = await hash(refreshToken, 10);
    await this.refreshTokens.save(tokenRecord);
    return { accessToken, refreshToken, user: this.publicUser(user) };
  }

  private publicUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      phoneVerified: user.phoneVerified,
      onboardingCompleted: user.onboardingCompleted,
      identityStatus: user.identityStatus,
    };
  }
}
