import { ForbiddenException } from "@nestjs/common";
import { MatchStatus } from "../database/entities";
import { FavoritesService } from "./favorites.service";
import { MatchesController } from "./matches.controller";

describe("favorite matches", () => {
  function setup(matched = true) {
    const execute = jest.fn();
    const insertBuilder = { insert: jest.fn().mockReturnThis(), into: jest.fn().mockReturnThis(), values: jest.fn().mockReturnThis(), orIgnore: jest.fn().mockReturnThis(), execute };
    const favorites = { find: jest.fn(), delete: jest.fn(), createQueryBuilder: jest.fn().mockReturnValue(insertBuilder) };
    const matches = { exists: jest.fn().mockResolvedValue(matched) };
    return { service: new FavoritesService(favorites as never, matches as never), favorites, matches, insertBuilder, execute };
  }

  it("stars a mutual match idempotently, looking the match up in canonical order", async () => {
    const { service, matches, insertBuilder, execute } = setup();
    await expect(service.set("zed", "amy", true)).resolves.toEqual({ memberId: "amy", favorite: true });
    expect(matches.exists).toHaveBeenCalledWith({ where: { userAId: "amy", userBId: "zed", status: MatchStatus.MATCHED } });
    expect(insertBuilder.values).toHaveBeenCalledWith({ userId: "zed", memberId: "amy" });
    expect(insertBuilder.orIgnore).toHaveBeenCalled();
    expect(execute).toHaveBeenCalled();
  });

  it("refuses to star someone who is not a mutual match", async () => {
    const { service, execute } = setup(false);
    await expect(service.set("zed", "amy", true)).rejects.toBeInstanceOf(ForbiddenException);
    expect(execute).not.toHaveBeenCalled();
  });

  it("unstars without needing a match (e.g. after an unmatch)", async () => {
    const { service, favorites, matches } = setup(false);
    await expect(service.set("zed", "amy", false)).resolves.toEqual({ memberId: "amy", favorite: false });
    expect(favorites.delete).toHaveBeenCalledWith({ userId: "zed", memberId: "amy" });
    expect(matches.exists).not.toHaveBeenCalled();
  });

  it("marks only the caller's own favourites on the match list", async () => {
    const list = [
      { id: "m1", userAId: "amy", userBId: "me" },
      { id: "m2", userAId: "me", userBId: "zed" },
    ];
    const controller = new MatchesController(
      { list: jest.fn().mockResolvedValue(list) } as never,
      { memberIds: jest.fn().mockResolvedValue(new Set(["zed"])) } as never,
    );
    const result = await controller.list({ sub: "me" } as never);
    expect(result.map((match) => [match.id, match.favorite])).toEqual([["m1", false], ["m2", true]]);
  });
});
