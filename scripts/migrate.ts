// Apply migrations to DATABASE_URL (or the local PGlite database).
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "../lib/db/client";
import { config } from "../lib/config";

async function main() {
  const db = await getDb(); // PGlite applies migrations on open
  if (config().DATABASE_URL) await migrate(db as never, { migrationsFolder: "db/migrations" });
  console.log("migrations applied");
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
