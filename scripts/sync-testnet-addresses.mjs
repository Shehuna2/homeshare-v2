import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const deploymentsFile = path.join(
  rootDir,
  'packages',
  'contracts',
  'deployments',
  'testnet-addresses.json'
);

const envTargets = [
  {
    label: 'Frontend',
    file: path.join(rootDir, 'packages', 'frontend', '.env.local'),
    prefix: 'VITE_',
  },
  {
    label: 'Backend',
    file: path.join(rootDir, 'packages', 'backend', '.env'),
    prefix: '',
  },
  {
    label: 'Contracts',
    file: path.join(rootDir, 'packages', 'contracts', '.env'),
    prefix: '',
  },
];

const networkKeyMap = {
  sepolia: 'SEPOLIA',
  'base-sepolia': 'BASE_SEPOLIA',
  'canton-testnet': 'CANTON_TESTNET',
};

function loadDeployments() {
  if (!fs.existsSync(deploymentsFile)) {
    throw new Error(`Deployment file not found at ${deploymentsFile}`);
  }
  return JSON.parse(fs.readFileSync(deploymentsFile, 'utf8'));
}

function updateEnvFile(filePath, entries) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Skipping missing env file: ${filePath}`);
    return;
  }

  let contents = fs.readFileSync(filePath, 'utf8');

  entries.forEach(({ key, value }) => {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    if (pattern.test(contents)) {
      contents = contents.replace(pattern, `${key}=${value}`);
    } else {
      contents = `${contents.trimEnd()}\n${key}=${value}\n`;
    }
  });

  fs.writeFileSync(filePath, contents, 'utf8');
  console.log(`✅ Updated ${filePath}`);
}

function buildEntries(deployments, prefix) {
  const entries = [];

  Object.entries(networkKeyMap).forEach(([network, envPrefix]) => {
    const deployment = deployments[network];
    if (!deployment) {
      console.warn(`⚠️  Missing deployment entry for ${network}`);
      return;
    }

    entries.push(
      { key: `${prefix}${envPrefix}_PROPERTY_TOKEN`, value: deployment.propertyToken },
      { key: `${prefix}${envPrefix}_PROPERTY_CROWDFUND`, value: deployment.propertyCrowdfund },
      { key: `${prefix}${envPrefix}_CHAIN_REGISTRY`, value: deployment.chainRegistry }
    );
  });

  return entries;
}

try {
  const deployments = loadDeployments();

  envTargets.forEach((target) => {
    const entries = buildEntries(deployments, target.prefix);
    if (entries.length === 0) {
      console.warn(`⚠️  No entries to update for ${target.label}`);
      return;
    }
    updateEnvFile(target.file, entries);
  });

  console.log('✅ Testnet contract addresses synced.');
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
