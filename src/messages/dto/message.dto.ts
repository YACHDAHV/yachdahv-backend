import { Type } from "class-transformer";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf, ValidateNested } from "class-validator";

export const MESSAGE_META_KINDS = ["guided-question", "guided-answer", "reply"] as const;

export class MessageMetaDto {
  @IsIn(MESSAGE_META_KINDS) kind!: string;
  @ValidateIf((meta: MessageMetaDto) => meta.kind !== "reply") @IsString() @MinLength(1) @MaxLength(100) topicKey?: string;
  @ValidateIf((meta: MessageMetaDto) => meta.kind === "reply") @IsUUID() replyToId?: string;
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
