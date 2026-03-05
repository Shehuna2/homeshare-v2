import { JsonRpcProvider, Interface } from 'ethers';
import { QueryTypes } from 'sequelize';

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { sequelize } = await import('../dist/db/index.js');
await import('../dist/config/env.js');

const usage = () => {
  console.log(`Usage:
  pnpm --filter @homeshare/backend backfill:profit-distributors -- [propertyId] [--dry-run]
`);
};

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
const propertyIdFilter = args.find((arg) => !arg.startsWith('--')) || null;
const dryRun = args.includes('--dry-run');

const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || process.env.BASE_MAINNET_RPC_URL || '';
if (!rpcUrl) {
  throw new Error('Missing BASE_SEPOLIA_RPC_URL (or BASE_MAINNET_RPC_URL)');
}

const provider = new JsonRpcProvider(rpcUrl);
const distributorReadInterface = new Interface([
  'function usdcToken() view returns (address)',
  'function equityToken() view returns (address)',
]);

const loadMissingMappings = async () =>
  sequelize.query(
    `
    SELECT
      p.id AS "propertyUuid",
      p.property_id AS "propertyId",
      p.chain_id::text AS "chainId",
      LOWER(p.profit_distributor_address) AS "profitDistributorAddress"
    FROM properties p
    LEFT JOIN profit_distributors pd
      ON LOWER(pd.contract_address) = LOWER(p.profit_distributor_address)
    WHERE p.profit_distributor_address IS NOT NULL
      AND pd.id IS NULL
      ${propertyIdFilter ? 'AND p.property_id = :propertyId' : ''}
    ORDER BY p.created_at ASC
    `,
    {
      type: QueryTypes.SELECT,
      replacements: {
        propertyId: propertyIdFilter,
      },
    }
  );

const readDistributorMetadata = async (address) => {
  const code = await provider.getCode(address);
  if (!code || code === '0x') {
    throw new Error(`No contract code at ${address}`);
  }

  const usdcRaw = await provider.call({
    to: address,
    data: distributorReadInterface.encodeFunctionData('usdcToken', []),
  });
  const equityRaw = await provider.call({
    to: address,
    data: distributorReadInterface.encodeFunctionData('equityToken', []),
  });
  const [usdcToken] = distributorReadInterface.decodeFunctionResult('usdcToken', usdcRaw);
  const [equityToken] = distributorReadInterface.decodeFunctionResult('equityToken', equityRaw);

  return {
    usdcTokenAddress: String(usdcToken).toLowerCase(),
    equityTokenAddress: String(equityToken).toLowerCase(),
  };
};

const insertMapping = async (row, metadata) => {
  // Synthetic creation markers keep uniqueness while preserving idempotency.
  const syntheticCreatedTxHash = `backfill:${row.profitDistributorAddress}`;
  await sequelize.query(
    `
    INSERT INTO profit_distributors (
      id,
      property_id,
      chain_id,
      contract_address,
      usdc_token_address,
      equity_token_address,
      created_tx_hash,
      created_log_index,
      created_block_number,
      created_at
    )
    VALUES (
      gen_random_uuid(),
      :propertyUuid,
      :chainId,
      :contractAddress,
      :usdcTokenAddress,
      :equityTokenAddress,
      :createdTxHash,
      0,
      0,
      NOW()
    )
    ON CONFLICT (contract_address) DO NOTHING
    `,
    {
      replacements: {
        propertyUuid: row.propertyUuid,
        chainId: Number(row.chainId),
        contractAddress: row.profitDistributorAddress,
        usdcTokenAddress: metadata.usdcTokenAddress,
        equityTokenAddress: metadata.equityTokenAddress,
        createdTxHash: syntheticCreatedTxHash,
      },
    }
  );
};

const run = async () => {
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    return;
  }

  await sequelize.authenticate();
  const rows = await loadMissingMappings();
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('no missing profit_distributors mappings found');
    return;
  }

  console.log(
    `profit distributor mapping backfill candidates=${rows.length} dryRun=${dryRun} rpc=${rpcUrl}`
  );

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const metadata = await readDistributorMetadata(row.profitDistributorAddress);
      if (dryRun) {
        console.log(
          `dry-run property=${row.propertyId} distributor=${row.profitDistributorAddress} usdc=${metadata.usdcTokenAddress} equity=${metadata.equityTokenAddress}`
        );
        skipped += 1;
        continue;
      }

      await insertMapping(row, metadata);
      inserted += 1;
      console.log(
        `inserted property=${row.propertyId} distributor=${row.profitDistributorAddress} usdc=${metadata.usdcTokenAddress} equity=${metadata.equityTokenAddress}`
      );
    } catch (error) {
      failed += 1;
      console.error(
        `failed property=${row.propertyId} distributor=${row.profitDistributorAddress}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  console.log(`backfill complete inserted=${inserted} skipped=${skipped} failed=${failed}`);
};

try {
  await run();
} finally {
  await sequelize.close();
}
