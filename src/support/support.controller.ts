import { Body, Controller, Post } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLog } from "../database/entities";
import { ContactDto } from "./dto/contact.dto";

@Controller("support")
export class SupportController {
  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}
  @Post("contact")
  async contact(@Body() payload: ContactDto) {
    await this.logs.save(this.logs.create({
      actorId: null,
      action: "support.contact.received",
      targetType: "contact",
      targetId: null,
      metadata: { name: payload.name, email: payload.email, message: payload.message },
    }));
    return { success: true, message: "Your message has been received" };
  }
}
