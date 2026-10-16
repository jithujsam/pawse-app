// Apply migrations to the configured Postgres. Runs as part of the Vercel build.
// Plain JavaScript on purpose: the build needs no TypeScript runner.
// Uses the direct/session connection when the host provides one (DATABASE_URL_UNPOOLED).
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.warn("migrate: DATABASE_URL is not set, skipping (pages that need a database will not work)");
  process.exit(0);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "db/migrations" });
  console.log("migrate: done");
} catch (e) {
  console.error("migrate: failed", e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
