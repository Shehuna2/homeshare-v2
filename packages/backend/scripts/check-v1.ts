if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/homeshare';
}

const { default: app } = await import('../src/app.js');
const { sequelize } = await import('../src/db/index.js');

const originalQuery = sequelize.query.bind(sequelize);

const stubQueries = () => {
  sequelize.query = (async () => []) as typeof sequelize.query;
};

const restoreQueries = () => {
  sequelize.query = originalQuery;
};

const run = async () => {
  stubQueries();
  const server = app.listen(0);

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to start server');
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const healthRes = await fetch(`${baseUrl}/v1/health`);
    if (healthRes.status !== 200) {
      throw new Error(`GET /v1/health returned ${healthRes.status}`);
    }

    const healthBody = await healthRes.json();
    if (!healthBody || healthBody.ok !== true) {
      throw new Error('GET /v1/health returned unexpected body');
    }

    const propertiesRes = await fetch(`${baseUrl}/v1/properties`);
    if (propertiesRes.status !== 200) {
      throw new Error(`GET /v1/properties returned ${propertiesRes.status}`);
    }

    const propertiesBody = await propertiesRes.json();
    if (!propertiesBody || !Array.isArray(propertiesBody.properties)) {
      throw new Error('GET /v1/properties returned unexpected body');
    }

    console.log('v1 checks passed');
  } finally {
    server.close();
    restoreQueries();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
