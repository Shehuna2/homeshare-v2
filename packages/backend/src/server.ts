import app from './app.js';
import { env, validateEnv } from './config/env.js';
import { initDatabase } from './db/index.js';

async function startServer(): Promise<void> {
  validateEnv();
  await initDatabase();

  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
    console.log(`Health check: http://localhost:${env.port}/health`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
