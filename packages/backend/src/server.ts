import app from './app.js';
import { env, validateEnv } from './config/env.js';

validateEnv();

app.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
  console.log(`Health check: http://localhost:${env.port}/health`);
});
