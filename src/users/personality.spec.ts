import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PersonalityDto, mergePersonality } from "./personality";

describe("personality", () => {
  it("merges new answers over stored ones", () => {
    const merged = mergePersonality(
      { bibleCharacter: "Ruth", loveLanguage: "Quality time" },
      { loveLanguage: "Acts of service", loveStory: "ruth-boaz" },
    );
    expect(merged).toEqual({ bibleCharacter: "Ruth", loveLanguage: "Acts of service", loveStory: "ruth-boaz" });
  });

  it("trims the verse and drops it when blank", () => {
    expect(mergePersonality({}, { verse: "  Psalm 23  " }).verse).toBe("Psalm 23");
    expect(mergePersonality({ verse: "Psalm 23" }, { verse: "   " })).not.toHaveProperty("verse");
  });

  it("rejects answers outside the known options", async () => {
    const dto = plainToInstance(PersonalityDto, { bibleCharacter: "Goliath", loveStory: "romeo-juliet", verse: "x".repeat(201) });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property).sort()).toEqual(["bibleCharacter", "loveStory", "verse"]);
  });
});
