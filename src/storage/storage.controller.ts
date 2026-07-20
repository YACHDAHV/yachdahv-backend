import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateUploadDto } from "./dto/upload.dto";
import { StorageService } from "./storage.service";

@UseGuards(JwtAuthGuard)
@Controller("uploads")
export class StorageController {
  constructor(private readonly storage: StorageService) {}
  @Post("presign")
  create(@CurrentUser() user: AuthenticatedUser, @Body() payload: CreateUploadDto) {
    return this.storage.createUpload(user.sub, payload);
  }
}
