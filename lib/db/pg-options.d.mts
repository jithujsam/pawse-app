export function databaseUrl(): string | undefined;
export function migrationUrl(): string | undefined;
export function poolOptions(connectionString: string): {
  connectionString: string;
  ssl?: { ca?: string; rejectUnauthorized: boolean };
};
