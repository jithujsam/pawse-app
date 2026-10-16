import { afterEach, describe, expect, it } from "vitest";
import { databaseUrl, migrationUrl, poolOptions } from "@/lib/db/pg-options.mjs";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("database connection options", () => {
  it("verifies Supabase hosts against the bundled Supabase root CA, not by turning checks off", () => {
    const o = poolOptions("postgres://u:p@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x");
    expect(o.ssl?.rejectUnauthorized).toBe(true);
    expect(o.ssl?.ca).toContain("BEGIN CERTIFICATE");
    expect(o.connectionString).not.toContain("sslmode");
    expect(o.connectionString).toContain("supa=base-pooler.x");
  });

  it("covers direct supabase.co hosts too", () => {
    expect(poolOptions("postgres://u:p@db.abc.supabase.co:5432/postgres").ssl?.rejectUnauthorized).toBe(true);
  });

  it("leaves other hosts to the driver's defaults", () => {
    expect(poolOptions("postgres://u:p@ep-x.neon.tech/db?sslmode=require")).toEqual({
      connectionString: "postgres://u:p@ep-x.neon.tech/db?sslmode=require",
    });
    expect(poolOptions("postgres://u:p@notsupabase.com.evil.io/db").ssl).toBeUndefined();
  });

  it("honours an explicit CA and the documented insecure fallback", () => {
    process.env.DATABASE_CA_CERT = "PEM";
    expect(poolOptions("postgres://u:p@h/db").ssl).toEqual({ ca: "PEM", rejectUnauthorized: true });
    delete process.env.DATABASE_CA_CERT;
    process.env.DATABASE_SSL_NO_VERIFY = "true";
    expect(poolOptions("postgres://u:p@h/db").ssl).toEqual({ rejectUnauthorized: false });
  });

  it("accepts Vercel integration variable names", () => {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_UNPOOLED;
    process.env.POSTGRES_URL = "postgres://pooled";
    process.env.POSTGRES_URL_NON_POOLING = "postgres://direct";
    expect(databaseUrl()).toBe("postgres://pooled");
    expect(migrationUrl()).toBe("postgres://direct");
  });
});
