import { IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateConversationDto {
  @IsUUID()
  memberId!: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
