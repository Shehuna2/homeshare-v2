import { Sequelize } from 'sequelize';
import { env } from '../config/env.js';
import { initModels } from '../models/index.js';

export const sequelize = new Sequelize(env.databaseUrl, {
  logging: false,
});

export async function initDatabase(): Promise<void> {
  await sequelize.authenticate();
  initModels(sequelize);
}
