// Postgres connection settings shared by the app and the build-time migration script.
// Plain JavaScript so scripts/migrate.mjs can import it without a TypeScript runner.
import fs from "node:fs";
import path from "node:path";

/** App connection. Vercel's Supabase and Neon integrations may use POSTGRES_URL instead. */
export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

/** Migrations prefer a direct or session-mode connection when the host provides one. */
export function migrationUrl() {
  return process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || databaseUrl();
}

const SUPABASE_CA = path.join(process.cwd(), "db/certs/supabase-root-2021.crt");

/**
 * pg options for a connection string. Supabase signs its certificates with its own
 * root CA, which Node doesn't trust by default, so `sslmode=require` URLs fail with
 * "self-signed certificate in certificate chain". We verify against that CA instead
 * of switching verification off.
 */
export function poolOptions(connectionString) {
  const url = new URL(connectionString);
  let ca = process.env.DATABASE_CA_CERT || undefined;
  if (!ca && /(^|\.)supabase\.(co|com)$/.test(url.hostname)) ca = fs.readFileSync(SUPABASE_CA, "utf8");
  const noVerify = process.env.DATABASE_SSL_NO_VERIFY === "true"; // last resort, documented as insecure
  if (!ca && !noVerify) return { connectionString };
  // SSL settings in the URL would override the ssl object below.
  for (const k of ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) url.searchParams.delete(k);
  return {
    connectionString: url.toString(),
    ssl: noVerify ? { rejectUnauthorized: false } : { ca, rejectUnauthorized: true },
  };
}
