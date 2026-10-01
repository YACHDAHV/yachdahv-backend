import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FavoriteMatch, Match, MatchStatus } from "../database/entities";

/** "Favorite matches": each member's own starred mutual matches, stored server-side so they follow them across devices. */
@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(FavoriteMatch) private readonly favorites: Repository<FavoriteMatch>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
  ) {}

  async memberIds(userId: string) {
    const rows = await this.favorites.find({ where: { userId }, select: { memberId: true } });
    return new Set(rows.map((row) => row.memberId));
  }

  async set(userId: string, memberId: string, favorite: boolean) {
    if (!favorite) {
      await this.favorites.delete({ userId, memberId });
      return { memberId, favorite: false };
    }
    const [userAId, userBId] = [userId, memberId].sort();
    if (!(await this.matches.exists({ where: { userAId, userBId, status: MatchStatus.MATCHED } }))) {
      throw new ForbiddenException("Only mutual matches can be added to favourites");
    }
    await this.favorites.createQueryBuilder().insert().into(FavoriteMatch).values({ userId, memberId }).orIgnore().execute();
    return { memberId, favorite: true };
  }
}
