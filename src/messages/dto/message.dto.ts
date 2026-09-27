import { Type } from "class-transformer";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from "class-validator";

export const MESSAGE_META_KINDS = ["guided-question", "guided-answer"] as const;

export class MessageMetaDto {
  @IsIn(MESSAGE_META_KINDS) kind!: string;
  @IsString() @MinLength(1) @MaxLength(100) topicKey!: string;
}

export class CreateConversationDto {
  @IsUUID()
  memberId!: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MessageMetaDto)
  meta?: MessageMetaDto;
}
