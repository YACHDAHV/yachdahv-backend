import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class ContactDto {
  @IsString() @MaxLength(80) name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(5) @MaxLength(2000) message!: string;
}
