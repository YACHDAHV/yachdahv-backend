import { UserRole } from "../database/entities";

export interface AuthenticatedUser {
  sub: string;
  role: UserRole;
  email?: string;
  type: "access";
}
