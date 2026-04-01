import { neon } from "@neondatabase/serverless";

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error("Database URL is missing");
}

export const sql = neon(databaseUrl);