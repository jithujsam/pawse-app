import path from "node:path";
import fs from "node:fs";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { config } from "../config";
import * as schema from "./schema";

export type Schema = typeof schema;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DB = PgDatabase<PgQueryResultHKT & any, Schema>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Tx = PgTransaction<PgQueryResultHKT & any, Schema, ExtractTablesWithRelations<Schema>>;
/** Either the root connection or a transaction; repository functions accept both. */
export type Conn = DB | Tx;

const MIGRATIONS = path.join(process.cwd(), "db/migrations");

type Holder = { db?: DB; ready?: Promise<DB> };
const g = globalThis as unknown as { __db?: Holder };
const holder: Holder = (g.__db ??= {});

/** Postgres when DATABASE_URL is set, otherwise embedded PGlite (local dev, demos, tests). */
export async function getDb(): Promise<DB> {
  if (holder.db) return holder.db;
  holder.ready ??= connect();
  holder.db = await holder.ready;
  return holder.db;
}

async function connect(): Promise<DB> {
  const url = config().DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { poolOptions } = await import("./pg-options.mjs");
    const pool = new Pool({ ...poolOptions(url), max: 5 });
    return drizzle(pool, { schema }) as unknown as DB;
  }
  const dir = config().PGLITE_DIR;
  fs.mkdirSync(dir, { recursive: true });
  const db = await createPglite(dir);
  return db;
}

/** PGlite database with migrations applied. `dataDir` undefined = in-memory. */
export async function createPglite(dataDir?: string): Promise<DB> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

/** Tests swap in an isolated database. */
export function setDb(db: DB) {
  holder.db = db;
  holder.ready = Promise.resolve(db);
}

export { schema };
