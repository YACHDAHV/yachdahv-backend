import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

// Answers from the onboarding "Quick Vibe Check". The frontend keeps the same
// option lists (components/vibe-check.jsx); keep both in sync.
export const MALE_BIBLE_CHARACTERS = ["David", "Joseph", "Solomon", "Boaz", "Nehemiah", "Daniel"] as const;
export const FEMALE_BIBLE_CHARACTERS = ["Ruth", "Esther", "Deborah", "Abigail", "Rebecca", "Hannah"] as const;
export const BIBLE_CHARACTERS = [...MALE_BIBLE_CHARACTERS, ...FEMALE_BIBLE_CHARACTERS] as const;

export const LOVE_LANGUAGES = [
  "Words of affirmation",
  "Quality time",
  "Receiving gifts",
  "Acts of service",
  "Physical touch",
] as const;

export const LOVE_STORIES = [
  "ruth-boaz",
  "jacob-rachel",
  "isaac-rebecca",
  "moses-zipporah",
  "aquila-priscilla",
  "esther-king",
] as const;

export class PersonalityDto {
  @IsOptional() @IsIn(BIBLE_CHARACTERS) bibleCharacter?: string;
  @IsOptional() @IsIn(BIBLE_CHARACTERS) admiredCharacter?: string;
  @IsOptional() @IsIn(LOVE_LANGUAGES) loveLanguage?: string;
  @IsOptional() @IsString() @MaxLength(200) verse?: string;
  @IsOptional() @IsIn(LOVE_STORIES) loveStory?: string;
}

export type Personality = {
  bibleCharacter?: string;
  admiredCharacter?: string;
  loveLanguage?: string;
  verse?: string;
  loveStory?: string;
};

/** Merges new answers over stored ones, trimming the free-text verse. */
export function mergePersonality(current: Personality | null | undefined, next: PersonalityDto | undefined): Personality {
  const merged: Personality = { ...(current ?? {}) };
  if (!next) return merged;
  for (const key of ["bibleCharacter", "admiredCharacter", "loveLanguage", "loveStory"] as const) {
    if (next[key] !== undefined) merged[key] = next[key];
  }
  if (next.verse !== undefined) {
    const verse = next.verse.trim();
    if (verse) merged.verse = verse;
    else delete merged.verse;
  }
  return merged;
}
