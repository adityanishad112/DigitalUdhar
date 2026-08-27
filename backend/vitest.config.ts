import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Isolated, ephemeral in-memory Postgres per run.
    env: {
      NODE_ENV: 'test',
      PGLITE_DATA_DIR: 'memory',
      JWT_SECRET: 'test-secret',
      IDENTITY_ENC_KEY: '0'.repeat(64),
      PAYMENT_GATEWAY_WEBHOOK_SECRET: 'test_webhook_secret',
      AUTO_SEED: 'false',
    },
    include: ['src/tests/**/*.test.ts'],
    hookTimeout: 30000,
    testTimeout: 30000,
    fileParallelism: false,
  },
});
