import "dotenv/config";
import { DataSource } from "typeorm";
import { databaseEntities } from "./entities";

export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: databaseEntities,
  migrations: [`${__dirname}/migrations/*{.js,.ts}`],
  synchronize: false,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});
