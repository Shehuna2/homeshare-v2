import { spawn } from 'child_process';

const workers = [
  {
    name: 'property-worker',
    script: 'scripts/process-property-intents.mjs',
    env: { PROPERTY_INTENT_CONTINUOUS: 'true' },
  },
  {
    name: 'profit-worker',
    script: 'scripts/process-profit-intents.mjs',
    env: { PROFIT_INTENT_CONTINUOUS: 'true' },
  },
  {
    name: 'platform-fee-worker',
    script: 'scripts/process-platform-fee-intents.mjs',
    env: { PLATFORM_FEE_INTENT_CONTINUOUS: 'true' },
  },
  {
    name: 'indexer-worker',
    script: 'scripts/process-indexer-sync.mjs',
    env: { INDEXER_CONTINUOUS: 'true' },
    optionalExitCode0: true,
  },
  {
    name: 'campaign-lifecycle-worker',
    script: 'scripts/process-campaign-lifecycle.mjs',
    env: { CAMPAIGN_LIFECYCLE_CONTINUOUS: 'true' },
  },
];

const children = [];
let shuttingDown = false;
let shutdownReason = null;

const stopAll = (signal = 'SIGTERM', reason = 'external-signal') => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  shutdownReason = reason;
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
};

for (const worker of workers) {
  const child = spawn('node', [worker.script], {
    stdio: 'inherit',
    env: { ...process.env, ...worker.env },
  });
  children.push(child);
  console.log(`[workers] started ${worker.name} pid=${child.pid}`);

  child.on('exit', (code, signal) => {
    console.log(`[workers] ${worker.name} exited code=${code ?? 'null'} signal=${signal ?? 'null'}`);
    if (!shuttingDown && worker.optionalExitCode0 && code === 0) {
      console.warn(`[workers] ${worker.name} exited with code=0 (optional); keeping other workers running`);
      return;
    }
    if (!shuttingDown && (signal === 'SIGTERM' || signal === 'SIGINT')) {
      console.warn(
        `[workers] ${worker.name} received ${signal}; treating as graceful shutdown and stopping all workers`
      );
      stopAll(signal, `worker-signal:${worker.name}`);
      return;
    }
    if (!shuttingDown) {
      console.error(`[workers] ${worker.name} exited unexpectedly; stopping all workers`);
      stopAll('SIGTERM', `unexpected-exit:${worker.name}`);
      process.exitCode = 1;
    }
  });
}

const maybeExitWhenDrained = () => {
  if (!shuttingDown) {
    return;
  }
  const alive = children.some((child) => child.exitCode === null && child.signalCode === null);
  if (alive) {
    return;
  }
  const shouldFail = process.exitCode && process.exitCode !== 0;
  if (!shouldFail) {
    console.log(`[workers] shutdown complete (${shutdownReason ?? 'graceful'})`);
    process.exit(0);
  }
};

for (const child of children) {
  child.on('exit', maybeExitWhenDrained);
}

process.on('SIGINT', () => stopAll('SIGINT', 'parent-sigint'));
process.on('SIGTERM', () => stopAll('SIGTERM', 'parent-sigterm'));
