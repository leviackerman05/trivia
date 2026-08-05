export interface ServerConfig {
  port: number;
  corsOrigins: string[];
  databaseUrl: string;
  /** M19: admin moderation token (env ADMIN_TOKEN) for drawing deletes. */
  adminToken: string;
}

function readEnv(name: string): string | undefined {
  return process.env[name];
}

export const config: ServerConfig = {
  port: Number(readEnv('PORT') ?? 3000),
  corsOrigins: (readEnv('CORS_ORIGIN') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  databaseUrl: readEnv('DATABASE_URL') ?? '',
  adminToken: readEnv('ADMIN_TOKEN') ?? '',
};

/**
 * CORS origin policy for Express + Socket.io.
 * Explicit list when configured; otherwise allow all (local development only.
 * production must set CORS_ORIGIN, enforced at deploy review).
 */
export function resolveCorsOrigin(): string[] | true {
  return config.corsOrigins.length > 0 ? config.corsOrigins : true;
}
