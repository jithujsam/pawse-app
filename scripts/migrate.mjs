// Apply migrations to the configured Postgres. Runs as part of the Vercel build.
// Plain JavaScript on purpose: the build needs no TypeScript runner.
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { migrationUrl, poolOptions } from "../lib/db/pg-options.mjs";

const url = migrationUrl();
if (!url) {
  console.warn("migrate: no DATABASE_URL (or POSTGRES_URL) set, skipping. Pages that need a database will not work.");
  process.exit(0);
}

const pool = new pg.Pool({ ...poolOptions(url), max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "db/migrations" });
  console.log(`migrate: done (${new URL(url).hostname})`);
} catch (e) {
  console.error("migrate: failed", e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
