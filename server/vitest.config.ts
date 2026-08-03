import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

// Load server/.env for local integration tests (CI provides env vars directly).
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}
// Keep test output readable: no structured request logs.
process.env.LOG_LEVEL = 'silent';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Integration suites share one dev/CI database — run files serially so
    // truncates and seeded data never race across workers.
    fileParallelism: false,
  },
});
