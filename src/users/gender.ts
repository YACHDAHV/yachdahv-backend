export const PROFILE_GENDERS = ["Male", "Female"] as const;
export type ProfileGender = (typeof PROFILE_GENDERS)[number];

export function normalizeGender(value?: string | null) {
  const gender = value?.trim().toLowerCase();
  if (gender === "male") return "Male";
  if (gender === "female") return "Female";
  return null;
}

export function oppositeGender(value?: string | null) {
  const gender = normalizeGender(value);
  if (gender === "Male") return "Female";
  if (gender === "Female") return "Male";
  return null;
}
