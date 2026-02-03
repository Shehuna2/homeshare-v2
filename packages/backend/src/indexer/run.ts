import { JsonRpcProvider } from 'ethers';
import { sequelize } from '../db/index.js';
import { Indexer } from './indexer.js';

const rpcUrl = process.env.RPC_URL ?? '';
const startBlock = Number(process.env.START_BLOCK ?? 0);
const dryRun = process.env.DRY_RUN === 'true';
const batchSize = Number(process.env.BATCH_SIZE ?? 1000);

async function main(): Promise<void> {
  if (!rpcUrl) {
    throw new Error('RPC_URL is required');
  }

  const provider = new JsonRpcProvider(rpcUrl);
  await sequelize.authenticate();

  const indexer = new Indexer(provider, sequelize, {
    deploymentBlock: startBlock,
    dryRun,
    batchSize,
  });

  await indexer.sync();
  await sequelize.close();
}

main().catch((error) => {
  console.error('Indexer failed:', error);
  process.exit(1);
});
