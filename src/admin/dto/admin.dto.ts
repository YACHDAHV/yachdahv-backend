import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { ReportStatus, UserStatus, VerificationStatus } from "../../database/entities";
import { ADMIN_PERMISSIONS, ADMIN_ROLES, AdminPermission, AdminRoleName } from "../admin.permissions";

export class AdminListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @IsEnum(VerificationStatus) verification?: VerificationStatus;
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}

export class ReviewVerificationDto {
  @IsEnum(VerificationStatus)
  status!: VerificationStatus.VERIFIED | VerificationStatus.REJECTED;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReviewReportDto {
  @IsEnum(ReportStatus)
  status!: ReportStatus;
}

export class IdDto {
  @IsUUID()
  id!: string;
}

export class InviteAdminDto {
  @IsString() @MaxLength(80) name!: string;
  @IsEmail() @MaxLength(160) email!: string;
  @IsIn(ADMIN_ROLES) role!: AdminRoleName;
}

export class UpdateRolePermissionsDto {
  @IsObject()
  roles!: Record<AdminRoleName, AdminPermission[]>;
}

export class UpdateAdminPreferencesDto {
  @IsBoolean() newUsers!: boolean;
  @IsBoolean() verification!: boolean;
  @IsBoolean() reports!: boolean;
  @IsBoolean() digest!: boolean;
}

export class UpdateSystemControlsDto {
  @IsBoolean() matching!: boolean;
  @IsBoolean() maintenance!: boolean;
  @IsInt() @Min(1) @Max(50) weeklyLimit!: number;
}
