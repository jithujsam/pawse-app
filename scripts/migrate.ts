// Apply migrations to the configured Postgres. Runs as part of the Vercel build.
// Uses the direct (unpooled) connection when the host provides one.
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.warn("migrate: DATABASE_URL is not set, skipping (the app's pages that need a database will not work)");
    return;
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "db/migrations" });
    console.log("migrate: done");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("migrate: failed", e);
  process.exit(1);
});
