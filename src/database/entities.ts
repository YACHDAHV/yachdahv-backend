import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from "typeorm";

export enum UserRole {
  MEMBER = "member",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin",
}

export enum UserStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  DEACTIVATED = "deactivated",
}

export enum VerificationStatus {
  NOT_STARTED = "not_started",
  SUBMITTED = "submitted",
  VERIFIED = "verified",
  REJECTED = "rejected",
}

export enum MatchStatus {
  SUGGESTED = "suggested",
  MATCHED = "matched",
  PASSED = "passed",
}

export enum ReportStatus {
  OPEN = "open",
  REVIEWING = "reviewing",
  RESOLVED = "resolved",
  DISMISSED = "dismissed",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 160, nullable: true })
  email!: string | null;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 40, nullable: true })
  phone!: string | null;

  @Column({ name: "password_hash", type: "varchar", length: 120, nullable: true, select: false })
  passwordHash!: string | null;

  @Column({ type: "varchar", length: 80 })
  name!: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.MEMBER })
  role!: UserRole;

  @Column({ type: "enum", enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Column({ name: "phone_verified", default: false })
  phoneVerified!: boolean;

  @Column({ name: "onboarding_completed", default: false })
  onboardingCompleted!: boolean;

  @Column({ name: "identity_status", type: "enum", enum: VerificationStatus, default: VerificationStatus.NOT_STARTED })
  identityStatus!: VerificationStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @OneToOne(() => Profile, (profile) => profile.user)
  profile?: Relation<Profile>;

  @OneToOne(() => Preference, (preference) => preference.user)
  preference?: Relation<Preference>;

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications?: Relation<Notification[]>;
}

@Entity("profiles")
export class Profile {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @OneToOne(() => User, (user) => user.profile, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @Column({ type: "smallint", nullable: true })
  age!: number | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  gender!: string | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  occupation!: string | null;

  @Column({ type: "varchar", length: 60, nullable: true })
  country!: string | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  city!: string | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  bio!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  church!: string | null;

  @Column({ name: "invite_code", type: "varchar", length: 40, nullable: true })
  inviteCode!: string | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  intention!: string | null;

  @Column({ name: "looking_for", type: "varchar", length: 300, nullable: true })
  lookingFor!: string | null;

  @Column({ type: "varchar", length: 60, nullable: true })
  children!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  education!: string | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  denomination!: string | null;

  @Column({ name: "height_cm", type: "smallint", nullable: true })
  heightCm!: number | null;

  @Column({ type: "text", array: true, default: "{}" })
  interests!: string[];

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  photos!: Array<{ key: string; url?: string; primary?: boolean }>;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

@Entity("preferences")
export class Preference {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @OneToOne(() => User, (user) => user.preference, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @Column({ name: "min_age", type: "smallint", nullable: true })
  minAge!: number | null;

  @Column({ name: "max_age", type: "smallint", nullable: true })
  maxAge!: number | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  location!: string | null;

  @Column({ name: "max_distance_km", type: "smallint", nullable: true })
  maxDistanceKm!: number | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  education!: string | null;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

@Entity("phone_codes")
export class PhoneCode {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "varchar", length: 40 })
  phone!: string;

  @Column({ name: "code_hash", type: "varchar", length: 120, select: false })
  codeHash!: string;

  @Column({ name: "expires_at" })
  expiresAt!: Date;

  @Column({ name: "used_at", type: "timestamptz", nullable: true })
  usedAt!: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

@Entity("refresh_tokens")
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @Column({ name: "token_hash", type: "varchar", length: 120, select: false })
  tokenHash!: string;

  @Column({ name: "expires_at" })
  expiresAt!: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

@Entity("matches")
@Index(["userAId", "userBId"], { unique: true })
export class Match {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_a_id", type: "uuid" })
  userAId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_a_id" })
  userA!: Relation<User>;

  @Column({ name: "user_b_id", type: "uuid" })
  userBId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_b_id" })
  userB!: Relation<User>;

  @Column({ type: "enum", enum: MatchStatus, default: MatchStatus.SUGGESTED })
  status!: MatchStatus;

  @Column({ name: "liked_by_a", default: false })
  likedByA!: boolean;

  @Column({ name: "liked_by_b", default: false })
  likedByB!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

@Entity("conversations")
@Index(["userAId", "userBId"], { unique: true })
export class Conversation {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_a_id", type: "uuid" })
  userAId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_a_id" })
  userA!: Relation<User>;

  @Column({ name: "user_b_id", type: "uuid" })
  userBId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_b_id" })
  userB!: Relation<User>;

  @OneToMany(() => Message, (message) => message.conversation)
  messages?: Relation<Message[]>;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

@Entity("messages")
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "conversation_id", type: "uuid" })
  conversationId!: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, { onDelete: "CASCADE" })
  @JoinColumn({ name: "conversation_id" })
  conversation!: Relation<Conversation>;

  @Column({ name: "sender_id", type: "uuid" })
  senderId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sender_id" })
  sender!: Relation<User>;

  @Column({ type: "text" })
  body!: string;

  @Column({ name: "read_at", type: "timestamptz", nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, (user) => user.notifications, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @Column({ type: "varchar", length: 60 })
  type!: string;

  @Column({ type: "varchar", length: 120 })
  title!: string;

  @Column({ type: "varchar", length: 300 })
  body!: string;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  data!: Record<string, unknown>;

  @Column({ name: "read_at", type: "timestamptz", nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

@Entity("blocks")
@Index(["blockerId", "blockedId"], { unique: true })
export class Block {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "blocker_id", type: "uuid" })
  blockerId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "blocker_id" })
  blocker!: Relation<User>;

  @Column({ name: "blocked_id", type: "uuid" })
  blockedId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "blocked_id" })
  blocked!: Relation<User>;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

@Entity("reports")
export class Report {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "reporter_id", type: "uuid" })
  reporterId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "reporter_id" })
  reporter!: Relation<User>;

  @Column({ name: "reported_id", type: "uuid" })
  reportedId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "reported_id" })
  reported!: Relation<User>;

  @Column({ type: "varchar", length: 80 })
  reason!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  details!: string | null;

  @Column({ type: "enum", enum: ReportStatus, default: ReportStatus.OPEN })
  status!: ReportStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

@Entity("verification_submissions")
export class VerificationSubmission {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @Column({ name: "document_type", type: "varchar", length: 40 })
  documentType!: string;

  @Column({ name: "document_key", type: "varchar", length: 240 })
  documentKey!: string;

  @Column({ name: "selfie_key", type: "varchar", length: 240, nullable: true })
  selfieKey!: string | null;

  @Column({ type: "enum", enum: VerificationStatus, default: VerificationStatus.SUBMITTED })
  status!: VerificationStatus;

  @Column({ name: "review_note", type: "varchar", length: 500, nullable: true })
  reviewNote!: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "actor_id", type: "uuid", nullable: true })
  actorId!: string | null;

  @Column({ type: "varchar", length: 80 })
  action!: string;

  @Column({ name: "target_type", type: "varchar", length: 60 })
  targetType!: string;

  @Column({ name: "target_id", type: "varchar", length: 80, nullable: true })
  targetId!: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

export const databaseEntities = [
  User,
  Profile,
  Preference,
  PhoneCode,
  RefreshToken,
  Match,
  Conversation,
  Message,
  Notification,
  Block,
  Report,
  VerificationSubmission,
  AuditLog,
];
