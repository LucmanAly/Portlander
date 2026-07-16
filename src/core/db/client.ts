import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getConfig } from "@/core/config";
import * as schema from "./schema";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: getConfig().DATABASE_URL });
  }
  return pool;
}

export const db = drizzle(getPool(), { schema });

export * as schema from "./schema";
