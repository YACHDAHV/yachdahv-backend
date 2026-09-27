import { IsBoolean, IsIn } from "class-validator";

// Explicit consents required by NDPA 2023 s.30 for sensitive personal data.
// "sensitive_data": religious beliefs and relationship / private-life data used for matching.
// "biometric": selfie and liveness data used only for identity verification.
export const CONSENT_TYPES = ["sensitive_data", "biometric"] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

// Bump when the Privacy Policy changes in a way that needs fresh consent.
export const PRIVACY_POLICY_VERSION = "2026-09-04";

export class UpdateConsentDto {
  @IsIn(CONSENT_TYPES) type!: ConsentType;
  @IsBoolean() granted!: boolean;
}
