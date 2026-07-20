import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class ReportUserDto {
  @IsUUID()
  memberId!: string;

  @IsString()
  @MaxLength(80)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}
