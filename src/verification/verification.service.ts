import { ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User, VerificationStatus, VerificationSubmission } from "../database/entities";
import { SubmitVerificationDto } from "./dto/verification.dto";

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(VerificationSubmission) private readonly submissions: Repository<VerificationSubmission>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async status(userId: string) {
    return this.submissions.findOne({ where: { userId }, order: { createdAt: "DESC" } });
  }

  async submit(userId: string, payload: SubmitVerificationDto) {
    const pending = await this.submissions.exists({ where: { userId, status: VerificationStatus.SUBMITTED } });
    if (pending) throw new ConflictException("A verification submission is already being reviewed");
    const submission = await this.submissions.save(this.submissions.create({
      userId,
      documentType: payload.documentType,
      documentKey: payload.documentKey,
      selfieKey: payload.selfieKey ?? null,
      status: VerificationStatus.SUBMITTED,
    }));
    await this.users.update(userId, { identityStatus: VerificationStatus.SUBMITTED });
    return submission;
  }
}
